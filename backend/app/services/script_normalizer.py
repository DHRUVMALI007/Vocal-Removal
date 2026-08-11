from __future__ import annotations

import logging
import re
import unicodedata

from app.models.schemas import LyricLine

logger = logging.getLogger(__name__)

# Arabic-script blocks used by Urdu and related writing systems. The app keeps
# English, Devanagari Hindi, and Gujarati untouched and converts only characters
# from these blocks when they leak into an ASR result.
_ARABIC_RANGES = (
    (0x0600, 0x06FF),
    (0x0750, 0x077F),
    (0x08A0, 0x08FF),
    (0xFB50, 0xFDFF),
    (0xFE70, 0xFEFF),
)

# Phonetic, script-only fallback for the small number of cases where a
# Hindi-forced Whisper pass still emits Arabic/Urdu characters. This is not a
# semantic translation and does not rewrite English, Hindi, or Gujarati text.
_ARABIC_TO_DEVANAGARI = {
    "ء": "",
    "آ": "आ",
    "أ": "अ",
    "ؤ": "व",
    "إ": "इ",
    "ئ": "य",
    "ا": "अ",
    "ب": "ब",
    "پ": "प",
    "ت": "त",
    "ٹ": "ट",
    "ث": "स",
    "ج": "ज",
    "چ": "च",
    "ح": "ह",
    "خ": "ख़",
    "د": "द",
    "ڈ": "ड",
    "ذ": "ज़",
    "ر": "र",
    "ڑ": "ड़",
    "ز": "ज़",
    "ژ": "ज़",
    "س": "स",
    "ش": "श",
    "ص": "स",
    "ض": "ज़",
    "ط": "त",
    "ظ": "ज़",
    "ع": "अ",
    "غ": "ग़",
    "ف": "फ़",
    "ق": "क़",
    "ك": "क",
    "ک": "क",
    "گ": "ग",
    "ل": "ल",
    "م": "म",
    "ن": "न",
    "ں": "ं",
    "و": "व",
    "ه": "ह",
    "ہ": "ह",
    "ھ": "ह",
    "ة": "ह",
    "ۃ": "ह",
    "ۀ": "ह",
    "ۂ": "ह",
    "ي": "य",
    "ی": "य",
    "ى": "य",
    "ے": "ए",
    "ۓ": "ए",
    "ﻻ": "लअ",
    "لا": "लअ",
    "،": ",",
    "؛": ";",
    "؟": "?",
    "٪": "%",
    "٫": ".",
    "٬": ",",
    "٠": "०",
    "١": "१",
    "٢": "२",
    "٣": "३",
    "٤": "४",
    "٥": "५",
    "٦": "६",
    "٧": "७",
    "٨": "८",
    "٩": "९",
    "۰": "०",
    "۱": "१",
    "۲": "२",
    "۳": "३",
    "۴": "४",
    "۵": "५",
    "۶": "६",
    "۷": "७",
    "۸": "८",
    "۹": "९",
}

_WHITESPACE_RE = re.compile(r"[ \t]+")
_SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,.;:!?])")


def _is_arabic_script_char(char: str) -> bool:
    codepoint = ord(char)
    return any(start <= codepoint <= end for start, end in _ARABIC_RANGES)


def contains_arabic_script(text: str) -> bool:
    """Return True when any Arabic-script code point is present."""
    return any(_is_arabic_script_char(char) for char in text)


def contains_arabic_letters(text: str) -> bool:
    """Return True only for Arabic-script letters, ignoring punctuation/digits."""
    return any(
        _is_arabic_script_char(char) and unicodedata.category(char).startswith("L")
        for char in text
    )


def lines_contain_arabic_letters(lines: list[LyricLine]) -> bool:
    return any(contains_arabic_letters(line.text) for line in lines)


def to_hindi_safe_text(text: str) -> str:
    """Guarantee that returned text contains no Arabic-script characters.

    The preferred path is a Hindi-forced ASR pass. This function is the final
    deterministic safety net for residual characters and old saved sessions.
    Non-Arabic text is preserved as-is.
    """
    if not contains_arabic_script(text):
        return text

    normalized = unicodedata.normalize("NFKC", text)
    output: list[str] = []

    for char in normalized:
        mapped = _ARABIC_TO_DEVANAGARI.get(char)
        if mapped is not None:
            output.append(mapped)
            continue

        if _is_arabic_script_char(char):
            # Arabic combining marks and unsupported presentation characters
            # are removed rather than leaking the original script to the UI.
            continue

        if char in {"\u200c", "\u200d"}:  # ZWNJ / ZWJ used inside Arabic text
            continue

        output.append(char)

    safe = "".join(output)
    safe = _WHITESPACE_RE.sub(" ", safe)
    safe = _SPACE_BEFORE_PUNCT_RE.sub(r"\1", safe)
    return safe.strip()


def make_hindi_safe_lines(lines: list[LyricLine]) -> tuple[list[LyricLine], bool]:
    """Return lyric lines with an absolute no-Arabic-script display guarantee."""
    changed = False
    safe_lines: list[LyricLine] = []

    for line in lines:
        safe_text = to_hindi_safe_text(line.text)
        changed = changed or safe_text != line.text
        safe_lines.append(
            LyricLine(
                start=line.start,
                end=line.end,
                text=safe_text,
            )
        )

    return safe_lines, changed

# Roman/Hinglish fallback used only when the user explicitly selected Hindi.
# The AI4Bharat-based hindi-xlit model runs locally and converts phonetic Roman
# words (for example "mera dil") to Devanagari without translating their meaning.
_LATIN_WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)*")
_HINDI_TRANSLITERATOR = None


def _is_devanagari_letter(char: str) -> bool:
    return 0x0900 <= ord(char) <= 0x097F and unicodedata.category(char).startswith("L")


def _is_latin_letter(char: str) -> bool:
    return char.isascii() and char.isalpha()


def hindi_script_profile(lines: list[LyricLine]) -> tuple[int, int, int]:
    """Return (Devanagari, Latin, Arabic) letter counts for Hindi quality checks."""
    devanagari = 0
    latin = 0
    arabic = 0
    for line in lines:
        for char in line.text:
            if _is_devanagari_letter(char):
                devanagari += 1
            elif _is_latin_letter(char):
                latin += 1
            elif _is_arabic_script_char(char) and unicodedata.category(char).startswith("L"):
                arabic += 1
    return devanagari, latin, arabic


def needs_hindi_native_script_retry(lines: list[LyricLine]) -> bool:
    """Retry Whisper when Hindi is mostly Roman or contains Arabic/Urdu letters."""
    devanagari, latin, arabic = hindi_script_profile(lines)
    if arabic:
        return True
    # A few English words in an otherwise Hindi song are fine. Retry only when
    # Roman letters clearly dominate the transcript.
    return latin >= 8 and latin > max(6, devanagari * 2)


def hindi_native_script_score(lines: list[LyricLine]) -> int:
    """Higher means the transcript is a better native-script Hindi candidate."""
    devanagari, latin, arabic = hindi_script_profile(lines)
    return (devanagari * 2) - latin - (arabic * 4)


def _load_hindi_transliterator():
    global _HINDI_TRANSLITERATOR
    if _HINDI_TRANSLITERATOR is not None:
        return _HINDI_TRANSLITERATOR

    try:
        from hindi_xlit import HindiTransliterator
    except ImportError as exc:
        raise RuntimeError(
            "Hindi Devanagari normalization is not installed. "
            "Run: python -m pip install -r backend/requirements.txt"
        ) from exc

    logger.info("Loading local Hindi transliteration model")
    _HINDI_TRANSLITERATOR = HindiTransliterator()
    return _HINDI_TRANSLITERATOR


def _first_hindi_candidate(value) -> str | None:
    if isinstance(value, dict):
        value = value.get("hi") or next(iter(value.values()), None)
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, (list, tuple)) and value:
        first = value[0]
        return first.strip() if isinstance(first, str) and first.strip() else None
    return None


def _build_hindi_word_map(words: list[str]) -> dict[str, str]:
    transliterator = _load_hindi_transliterator()
    unique_words = list(dict.fromkeys(words))
    converted: dict[str, str] = {}

    # Batch inference is substantially faster for a full song. Fall back to the
    # single-word API if a package version does not expose batch transliteration.
    batch_method = getattr(transliterator, "transliterate_batch", None)
    if callable(batch_method):
        try:
            batch_results = batch_method(unique_words)
            if len(batch_results) == len(unique_words):
                for word, result in zip(unique_words, batch_results):
                    candidate = _first_hindi_candidate(result)
                    if candidate:
                        converted[word] = candidate
        except Exception:
            logger.exception(
                "Batch Hindi transliteration failed; retrying word by word"
            )

    single_method = getattr(transliterator, "transliterate", None)
    if not callable(single_method):
        raise RuntimeError("Installed hindi-xlit package does not expose transliterate()")

    for word in unique_words:
        if word in converted:
            continue
        candidate = _first_hindi_candidate(single_method(word))
        if not candidate:
            raise RuntimeError(f"Could not convert Roman Hindi word to Devanagari: {word}")
        converted[word] = candidate

    return converted


def make_hindi_devanagari_lines(lines: list[LyricLine]) -> tuple[list[LyricLine], bool]:
    """Normalize selected Hindi lyrics to readable Devanagari only.

    Arabic/Urdu script is first removed with the deterministic safety mapping.
    Any remaining Roman words are then transliterated locally with hindi-xlit.
    Existing Devanagari, timestamps, punctuation and numbers are preserved.
    """
    safe_texts = [to_hindi_safe_text(line.text) for line in lines]
    roman_words = [
        match.group(0)
        for text in safe_texts
        for match in _LATIN_WORD_RE.finditer(text)
    ]
    word_map = _build_hindi_word_map(roman_words) if roman_words else {}

    changed = False
    normalized_lines: list[LyricLine] = []
    for line, safe_text in zip(lines, safe_texts):
        normalized = _LATIN_WORD_RE.sub(lambda match: word_map[match.group(0)], safe_text)
        normalized = _WHITESPACE_RE.sub(" ", normalized).strip()
        changed = changed or normalized != line.text
        normalized_lines.append(
            LyricLine(start=line.start, end=line.end, text=normalized)
        )

    # Do not silently leak another writing system after Hindi was selected.
    devanagari, latin, arabic = hindi_script_profile(normalized_lines)
    if latin or arabic:
        raise RuntimeError(
            "Hindi normalization left unsupported script characters in the lyrics"
        )
    if normalized_lines and devanagari == 0:
        raise RuntimeError("Hindi lyrics could not be normalized to Devanagari")

    return normalized_lines, changed

from __future__ import annotations

import re
import unicodedata

from app.models.schemas import LyricLine

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

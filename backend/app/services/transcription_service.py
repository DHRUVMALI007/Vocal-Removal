from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from app.models.schemas import LyricLine

logger = logging.getLogger(__name__)

SUPPORTED_TRANSCRIPTION_LANGUAGES = frozenset({"en", "hi", "gu"})
INDIC_TRANSCRIPTION_LANGUAGES = frozenset({"hi", "gu"})

# Whisper's initial_prompt is previous-text context, not an instruction API. Native
# script examples here bias Hindi/Gujarati decoding toward the script the user chose.
NATIVE_SCRIPT_PROMPTS = {
    "hi": "यह हिंदी गीत के बोल हैं। मैं, मेरा, तेरे, दिल, प्यार, जिंदगी, आजा, जाना, नहीं, है।",
    "gu": "આ ગુજરાતી ગીતના શબ્દો છે. હું, મારું, તારા, દિલ, પ્રેમ, જીવન, આજે, નથી, છે.",
}

# A slightly stronger Hindi context is used only when the first pass is dominated
# by Roman/Arabic script. The audio is still transcribed literally with task=transcribe.
HINDI_RETRY_PROMPT = (
    "यह हिंदी गीत है। हिंदी बोल देवनागरी में लिखे जाते हैं। "
    "मैं तुमसे प्यार करता हूँ। मेरा दिल, तेरी याद, जिंदगी, आजा, जाना, नहीं, है।"
)


@dataclass(slots=True)
class TranscriptionResult:
    lines: list[LyricLine]
    language: str | None = None
    language_probability: float | None = None
    model_name: str | None = None


class TranscriptionService(ABC):
    @abstractmethod
    async def transcribe(
        self,
        audio_path: Path,
        language: str | None = None,
        *,
        initial_prompt: str | None = None,
    ) -> TranscriptionResult:
        ...


class WhisperTranscriptionService(TranscriptionService):
    def __init__(
        self,
        model_size: str = "base",
        indic_model_size: str = "large-v3",
        device: str = "auto",
        compute_type: str = "auto",
        beam_size: int = 1,
        indic_beam_size: int = 5,
        vad_min_silence_ms: int = 500,
        condition_on_previous_text: bool = False,
    ) -> None:
        self.model_size = model_size
        self.indic_model_size = indic_model_size
        self.device = device
        self.compute_type = compute_type
        self.beam_size = max(1, beam_size)
        self.indic_beam_size = max(1, indic_beam_size)
        self.vad_min_silence_ms = max(100, vad_min_silence_ms)
        self.condition_on_previous_text = condition_on_previous_text
        self._models: dict[str, object] = {}

    def model_name_for_language(self, language: str) -> str:
        return self.indic_model_size if language in INDIC_TRANSCRIPTION_LANGUAGES else self.model_size

    def beam_size_for_language(self, language: str) -> int:
        return self.indic_beam_size if language in INDIC_TRANSCRIPTION_LANGUAGES else self.beam_size

    def _resolve_device(self) -> str:
        if self.device != "auto":
            return self.device
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def _resolve_compute_type(self, device: str) -> str:
        if self.compute_type != "auto":
            return self.compute_type
        return "float16" if device == "cuda" else "int8"

    def _get_model(self, model_size: str):
        model = self._models.get(model_size)
        if model is not None:
            return model

        from faster_whisper import WhisperModel

        device = self._resolve_device()
        compute_type = self._resolve_compute_type(device)
        logger.info(
            "Loading Whisper model=%s device=%s compute=%s",
            model_size,
            device,
            compute_type,
        )
        model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
        )
        self._models[model_size] = model
        return model

    async def transcribe(
        self,
        audio_path: Path,
        language: str | None = None,
        *,
        initial_prompt: str | None = None,
    ) -> TranscriptionResult:
        import asyncio

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            self._transcribe_sync,
            audio_path,
            language,
            initial_prompt,
        )

    def _transcribe_sync(
        self,
        audio_path: Path,
        language: str | None,
        initial_prompt: str | None = None,
    ) -> TranscriptionResult:
        if language not in SUPPORTED_TRANSCRIPTION_LANGUAGES:
            raise ValueError("Lyrics language must be one of: en, hi, gu")

        model_name = self.model_name_for_language(language)
        beam_size = self.beam_size_for_language(language)
        model = self._get_model(model_name)
        logger.info(
            "Transcribing %s with Whisper (%s, language=%s, beam=%d)",
            audio_path,
            model_name,
            language,
            beam_size,
        )

        # Literal transcription only: no translation task or semantic rewriting.
        # Hindi/Gujarati use the higher-accuracy Indic model and native-script
        # context so Whisper is less likely to return Romanized lyrics.
        kwargs: dict = {
            "task": "transcribe",
            "language": language,
            "beam_size": beam_size,
            "best_of": 1,
            "temperature": 0.0,
            "word_timestamps": False,
            "vad_filter": True,
            "vad_parameters": {"min_silence_duration_ms": self.vad_min_silence_ms},
            "condition_on_previous_text": self.condition_on_previous_text,
        }
        prompt = initial_prompt or NATIVE_SCRIPT_PROMPTS.get(language)
        if prompt:
            kwargs["initial_prompt"] = prompt

        segments, info = model.transcribe(str(audio_path), **kwargs)
        lines: list[LyricLine] = []

        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            lines.append(
                LyricLine(
                    start=round(segment.start, 3),
                    end=round(segment.end, 3),
                    text=text,
                )
            )

        detected_language = getattr(info, "language", None)
        language_probability = getattr(info, "language_probability", None)
        logger.info(
            "Transcribed %d lyric lines [language=%s probability=%s model=%s]",
            len(lines),
            detected_language,
            language_probability,
            model_name,
        )
        return TranscriptionResult(
            lines=lines,
            language=detected_language,
            language_probability=(
                round(float(language_probability), 4)
                if language_probability is not None
                else None
            ),
            model_name=model_name,
        )

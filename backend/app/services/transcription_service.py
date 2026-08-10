from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from app.models.schemas import LyricLine

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class TranscriptionResult:
    lines: list[LyricLine]
    language: str | None = None
    language_probability: float | None = None


class TranscriptionService(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: Path, language: str | None = None) -> TranscriptionResult:
        ...


class WhisperTranscriptionService(TranscriptionService):
    def __init__(
        self,
        model_size: str = "large-v3",
        device: str = "auto",
        compute_type: str = "auto",
        beam_size: int = 1,
        vad_min_silence_ms: int = 500,
        condition_on_previous_text: bool = False,
    ) -> None:
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.beam_size = max(1, beam_size)
        self.vad_min_silence_ms = max(100, vad_min_silence_ms)
        self.condition_on_previous_text = condition_on_previous_text
        self._model = None

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

    def _get_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            device = self._resolve_device()
            compute_type = self._resolve_compute_type(device)
            logger.info(
                "Loading Whisper model=%s device=%s compute=%s",
                self.model_size,
                device,
                compute_type,
            )
            self._model = WhisperModel(
                self.model_size,
                device=device,
                compute_type=compute_type,
            )
        return self._model

    async def transcribe(self, audio_path: Path, language: str | None = None) -> TranscriptionResult:
        import asyncio

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, audio_path, language)

    def _transcribe_sync(self, audio_path: Path, language: str | None) -> TranscriptionResult:
        model = self._get_model()
        logger.info(
            "Transcribing %s with Whisper (%s, language=%s, beam=%d)",
            audio_path,
            self.model_size,
            language or "auto",
            self.beam_size,
        )

        # Literal transcription mode: ask Whisper for same-language speech
        # recognition and keep its segment text directly. There is deliberately
        # no translation task, LLM cleanup, grammar correction, prompt, or
        # application hotword list that could rewrite words into something "more sensible".
        # The UI needs segment timestamps, not expensive per-word alignment.
        kwargs: dict = {
            "task": "transcribe",
            "beam_size": self.beam_size,
            "best_of": 1,
            "temperature": 0.0,
            "word_timestamps": False,
            "vad_filter": True,
            "vad_parameters": {"min_silence_duration_ms": self.vad_min_silence_ms},
            "condition_on_previous_text": self.condition_on_previous_text,
        }
        if language:
            kwargs["language"] = language

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
            "Transcribed %d lyric lines [language=%s probability=%s]",
            len(lines),
            detected_language,
            language_probability,
        )
        return TranscriptionResult(
            lines=lines,
            language=detected_language,
            language_probability=(
                round(float(language_probability), 4)
                if language_probability is not None
                else None
            ),
        )

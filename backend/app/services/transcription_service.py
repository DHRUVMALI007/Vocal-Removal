from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from pathlib import Path

from app.models.schemas import LyricLine

logger = logging.getLogger(__name__)


class TranscriptionService(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: Path, language: str | None = None) -> list[LyricLine]:
        ...


class WhisperTranscriptionService(TranscriptionService):
    def __init__(
        self,
        model_size: str = "large-v3",
        device: str = "auto",
        compute_type: str = "auto",
    ) -> None:
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
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
            logger.info("Loading Whisper model=%s device=%s compute=%s", self.model_size, device, compute_type)
            self._model = WhisperModel(self.model_size, device=device, compute_type=compute_type)
        return self._model

    async def transcribe(self, audio_path: Path, language: str | None = None) -> list[LyricLine]:
        import asyncio

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, audio_path, language)

    def _transcribe_sync(self, audio_path: Path, language: str | None) -> list[LyricLine]:
        model = self._get_model()
        logger.info("Transcribing %s with Whisper (%s)", audio_path, self.model_size)

        kwargs: dict = {"word_timestamps": True, "vad_filter": True}
        if language:
            kwargs["language"] = language

        segments, _info = model.transcribe(str(audio_path), **kwargs)
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

        logger.info("Transcribed %d lyric lines", len(lines))
        return lines

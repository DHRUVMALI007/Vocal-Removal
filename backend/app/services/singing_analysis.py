"""Future singing evaluation interfaces — not implemented in MVP."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path


class PitchAnalyzer(ABC):
    @abstractmethod
    async def extract_pitch(self, audio_path: Path) -> list[dict]:
        ...


class UserVoiceRecorder(ABC):
    @abstractmethod
    async def save_recording(self, job_id: str, audio_data: bytes) -> Path:
        ...


class MelodyExtractor(ABC):
    @abstractmethod
    async def extract_melody(self, audio_path: Path) -> list[dict]:
        ...


class SingingEvaluator(ABC):
    @abstractmethod
    async def evaluate(self, reference_path: Path, user_path: Path) -> dict:
        ...

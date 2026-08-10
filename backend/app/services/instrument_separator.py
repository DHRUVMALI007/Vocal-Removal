from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path


class InstrumentSeparator(ABC):
    """
    Future interface for specialized instrument separation (guitar, tabla, etc.).
    Not implemented in MVP — HTDemucs only provides drums/bass/other/vocals.
    """

    @abstractmethod
    async def separate_instruments(self, input_path: Path, output_dir: Path) -> dict[str, Path]:
        """Return mapping of instrument name -> file path for detected instruments only."""
        ...

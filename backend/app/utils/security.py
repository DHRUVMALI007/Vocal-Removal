from __future__ import annotations

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

SAFE_FILENAME = re.compile(r"[^a-zA-Z0-9._-]")


def sanitize_filename(name: str) -> str:
    """Strip path components and unsafe characters from a filename."""
    base = Path(name).name
    cleaned = SAFE_FILENAME.sub("_", base)
    return cleaned or "file"


def is_safe_path(base: Path, target: Path) -> bool:
    """Ensure target resolves within base directory."""
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def validate_extension(filename: str, allowed: set[str]) -> bool:
    ext = Path(filename).suffix.lstrip(".").lower()
    return ext in allowed


def validate_mime(content_type: str | None, allowed: set[str]) -> bool:
    if not content_type:
        return True
    mime_map = {
        "mp3": {"audio/mpeg", "audio/mp3"},
        "wav": {"audio/wav", "audio/x-wav", "audio/wave"},
        "flac": {"audio/flac", "audio/x-flac"},
        "m4a": {"audio/mp4", "audio/x-m4a", "audio/m4a"},
        "ogg": {"audio/ogg", "application/ogg"},
        "aac": {"audio/aac", "audio/x-aac"},
    }
    ct = content_type.split(";")[0].strip().lower()
    for ext in allowed:
        if ct in mime_map.get(ext, set()):
            return True
    return False

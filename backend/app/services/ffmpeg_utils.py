from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def _run_ffmpeg(args: list[str], timeout: int = 300) -> None:
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args]
    logger.debug("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {result.stderr.strip() or result.stdout.strip()}")


def convert_to_wav(input_path: Path, output_path: Path, sample_rate: int = 44100) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    _run_ffmpeg(
        [
            "-i",
            str(input_path),
            "-ac",
            "2",
            "-ar",
            str(sample_rate),
            "-sample_fmt",
            "s16",
            str(output_path),
        ]
    )


def get_audio_duration(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr.strip()}")
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def mix_stems(stem_paths: list[Path], output_path: Path) -> None:
    """Mix multiple WAV stems into one file."""
    if not stem_paths:
        raise ValueError("No stems to mix")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if len(stem_paths) == 1:
        _run_ffmpeg(["-i", str(stem_paths[0]), str(output_path)])
        return

    inputs: list[str] = []
    for p in stem_paths:
        inputs.extend(["-i", str(p)])
    filter_parts = "".join(f"[{i}:a]" for i in range(len(stem_paths)))
    filter_complex = f"{filter_parts}amix=inputs={len(stem_paths)}:duration=longest[aout]"
    _run_ffmpeg(
        [
            *inputs,
            "-filter_complex",
            filter_complex,
            "-map",
            "[aout]",
            str(output_path),
        ]
    )


def change_speed(input_path: Path, output_path: Path, speed: float) -> None:
    """Change playback speed without pitch change using atempo filter."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # atempo accepts 0.5-2.0; chain for wider range
    filters: list[str] = []
    remaining = speed
    while remaining < 0.5:
        filters.append("atempo=0.5")
        remaining /= 0.5
    while remaining > 2.0:
        filters.append("atempo=2.0")
        remaining /= 2.0
    filters.append(f"atempo={remaining:.4f}")
    _run_ffmpeg(["-i", str(input_path), "-af", ",".join(filters), str(output_path)])

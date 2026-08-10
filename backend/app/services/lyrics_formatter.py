from __future__ import annotations

from pathlib import Path

from app.models.schemas import LyricLine


def _format_timestamp_srt(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _format_timestamp_lrc(seconds: float) -> str:
    m = int(seconds // 60)
    s = seconds % 60
    return f"[{m:02d}:{s:05.2f}]"


def write_lyrics_txt(lines: list[LyricLine], path: Path) -> None:
    path.write_text("\n".join(line.text for line in lines), encoding="utf-8")


def write_lyrics_srt(lines: list[LyricLine], path: Path) -> None:
    blocks: list[str] = []
    for i, line in enumerate(lines, 1):
        blocks.append(
            f"{i}\n"
            f"{_format_timestamp_srt(line.start)} --> {_format_timestamp_srt(line.end)}\n"
            f"{line.text}\n"
        )
    path.write_text("\n".join(blocks), encoding="utf-8")


def write_lyrics_lrc(lines: list[LyricLine], path: Path) -> None:
    content = "\n".join(f"{_format_timestamp_lrc(line.start)}{line.text}" for line in lines)
    path.write_text(content, encoding="utf-8")


def export_lyrics(lines: list[LyricLine], job_dir: Path) -> dict[str, str]:
    txt_path = job_dir / "lyrics.txt"
    srt_path = job_dir / "lyrics.srt"
    lrc_path = job_dir / "lyrics.lrc"

    write_lyrics_txt(lines, txt_path)
    write_lyrics_srt(lines, srt_path)
    write_lyrics_lrc(lines, lrc_path)

    return {
        "txt_file": "lyrics.txt",
        "srt_file": "lyrics.srt",
        "lrc_file": "lyrics.lrc",
    }

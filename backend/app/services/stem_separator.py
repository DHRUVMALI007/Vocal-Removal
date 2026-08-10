from __future__ import annotations

import asyncio
import logging
import zipfile
from abc import ABC, abstractmethod
from pathlib import Path

logger = logging.getLogger(__name__)

# Demucs htdemucs outputs: drums, bass, other, vocals
DEMUCS_STEM_LABELS = {
    "vocals": "Vocals",
    "drums": "Drums / Percussion",
    "bass": "Bass",
    "other": "Other / Accompaniment",
}

CORE_STEMS = {"vocals", "drums", "bass", "other"}
INSTRUMENTAL_SOURCE_STEMS = {"drums", "bass", "other"}


class StemSeparator(ABC):
    """Interface for music source separation backends."""

    @abstractmethod
    async def separate(
        self,
        input_path: Path,
        output_dir: Path,
        required_stems: set[str] | None = None,
    ) -> dict[str, Path]:
        """Return mapping of saved stem name -> file path."""
        ...


class DemucsSeparator(StemSeparator):
    """HTDemucs-based 4-stem separation (vocals, drums, bass, other)."""

    def __init__(self, model_name: str = "htdemucs", device: str = "auto") -> None:
        self.model_name = model_name
        self.device = device

    def _resolve_device(self) -> str:
        if self.device != "auto":
            return self.device
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    async def separate(
        self,
        input_path: Path,
        output_dir: Path,
        required_stems: set[str] | None = None,
    ) -> dict[str, Path]:
        output_dir.mkdir(parents=True, exist_ok=True)
        device = self._resolve_device()
        logger.info(
            "Running Demucs (%s) on %s [device=%s, save=%s]",
            self.model_name,
            input_path,
            device,
            sorted(required_stems) if required_stems is not None else "all",
        )

        loop = asyncio.get_event_loop()
        stems = await loop.run_in_executor(
            None,
            self._run_demucs,
            input_path,
            output_dir,
            device,
            required_stems,
        )
        return stems

    def _run_demucs(
        self,
        input_path: Path,
        output_dir: Path,
        device: str,
        required_stems: set[str] | None,
    ) -> dict[str, Path]:
        import torch
        import torchaudio
        from demucs.apply import apply_model
        from demucs.pretrained import get_model

        model = get_model(self.model_name)
        model.to(device)
        model.eval()

        wav, sr = torchaudio.load(str(input_path))
        if wav.shape[0] == 1:
            wav = wav.repeat(2, 1)
        elif wav.shape[0] > 2:
            wav = wav[:2]

        if sr != model.samplerate:
            wav = torchaudio.functional.resample(wav, sr, model.samplerate)

        ref = wav.mean(0)
        wav = (wav - ref.mean()) / (ref.std() + 1e-8)
        wav = wav.unsqueeze(0).to(device)

        with torch.no_grad():
            # HTDemucs computes its four sources together. We only save the
            # sources needed for the user's requested outputs or internal steps.
            sources = apply_model(model, wav, device=device, progress=False)[0]

        stem_names = model.sources  # ['drums', 'bass', 'other', 'vocals']
        result: dict[str, Path] = {}

        for i, name in enumerate(stem_names):
            if required_stems is not None and name not in required_stems:
                continue
            stem_wav = sources[i].cpu()
            out_path = output_dir / f"{name}.wav"
            torchaudio.save(str(out_path), stem_wav, model.samplerate)
            result[name] = out_path
            logger.info("Saved stem: %s -> %s", name, out_path)

        return result


def create_instrumental_stem(stem_paths: dict[str, Path], output_path: Path) -> Path:
    """Mix non-vocal stems into instrumental/karaoke track."""
    from app.services.ffmpeg_utils import mix_stems

    non_vocal = [
        stem_paths[name]
        for name in ("drums", "bass", "other")
        if name in stem_paths
    ]
    if len(non_vocal) != 3:
        raise RuntimeError("Instrumental requires drums, bass, and other stems")
    mix_stems(non_vocal, output_path)
    return output_path


def create_zip_archive(job_dir: Path, files: list[Path], zip_path: Path) -> Path:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            if f.exists():
                zf.write(f, arcname=f.name)
    return zip_path

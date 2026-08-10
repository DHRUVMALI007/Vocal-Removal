from __future__ import annotations

import asyncio
import logging
import threading
import zipfile
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Callable

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
ProgressCallback = Callable[[float], None]


class StemSeparator(ABC):
    """Interface for music source separation backends."""

    @abstractmethod
    async def separate(
        self,
        input_path: Path,
        output_dir: Path,
        required_stems: set[str] | None = None,
        progress_callback: ProgressCallback | None = None,
    ) -> dict[str, Path]:
        """Return mapping of saved stem name -> file path."""
        ...


class DemucsSeparator(StemSeparator):
    """HTDemucs-based 4-stem separation (vocals, drums, bass, other)."""

    def __init__(
        self,
        model_name: str = "htdemucs",
        device: str = "auto",
        overlap: float = 0.15,
        shifts: int = 0,
    ) -> None:
        self.model_name = model_name
        self.device = device
        self.overlap = max(0.0, min(0.49, overlap))
        self.shifts = max(0, shifts)
        self._model = None
        self._model_device: str | None = None
        self._inference_lock = threading.Lock()

    def _resolve_device(self) -> str:
        if self.device != "auto":
            return self.device
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def _get_model(self, device: str):
        if self._model is None or self._model_device != device:
            from demucs.pretrained import get_model

            logger.info("Loading Demucs model=%s device=%s", self.model_name, device)
            model = get_model(self.model_name)
            model.to(device)
            model.eval()
            self._model = model
            self._model_device = device
        return self._model

    async def separate(
        self,
        input_path: Path,
        output_dir: Path,
        required_stems: set[str] | None = None,
        progress_callback: ProgressCallback | None = None,
    ) -> dict[str, Path]:
        output_dir.mkdir(parents=True, exist_ok=True)
        device = self._resolve_device()
        logger.info(
            "Running Demucs (%s) on %s [device=%s, overlap=%.2f, shifts=%d, save=%s]",
            self.model_name,
            input_path,
            device,
            self.overlap,
            self.shifts,
            sorted(required_stems) if required_stems is not None else "all",
        )

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            self._run_demucs,
            input_path,
            output_dir,
            device,
            required_stems,
            progress_callback,
        )

    def _run_demucs(
        self,
        input_path: Path,
        output_dir: Path,
        device: str,
        required_stems: set[str] | None,
        progress_callback: ProgressCallback | None,
    ) -> dict[str, Path]:
        import torch
        import torchaudio
        from demucs.apply import apply_model

        # The same JobManager owns one separator instance. Reusing the loaded
        # model removes repeated model initialization on every song, while this
        # lock prevents two jobs from competing for the same GPU/model object.
        with self._inference_lock:
            model = self._get_model(device)

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
            total_samples = max(1, int(wav.shape[-1]))
            segment_seconds = getattr(model, "segment", None)
            segment_samples = (
                max(1, int(float(segment_seconds) * model.samplerate))
                if segment_seconds
                else total_samples
            )

            def on_demucs_progress(data: dict) -> None:
                if progress_callback is None or data.get("state") != "end":
                    return
                offset = max(0, int(data.get("segment_offset", 0)))
                within_track = min(1.0, (offset + segment_samples) / total_samples)
                model_index = max(0, int(data.get("model_idx_in_bag", 0)))
                model_count = max(1, int(data.get("models", 1)))
                shift_count = max(1, self.shifts)
                shift_index = max(0, int(data.get("shift_idx", 0))) if self.shifts else 0
                within_model = min(1.0, (shift_index + within_track) / shift_count)
                progress_callback(min(1.0, (model_index + within_model) / model_count))

            with torch.no_grad():
                sources = apply_model(
                    model,
                    wav,
                    device=device,
                    progress=False,
                    shifts=self.shifts,
                    overlap=self.overlap,
                    callback=on_demucs_progress if progress_callback else None,
                )[0]

            stem_names = model.sources
            result: dict[str, Path] = {}

            for i, name in enumerate(stem_names):
                if required_stems is not None and name not in required_stems:
                    continue
                stem_wav = sources[i].cpu()
                out_path = output_dir / f"{name}.wav"
                torchaudio.save(str(out_path), stem_wav, model.samplerate)
                result[name] = out_path
                logger.info("Saved stem: %s -> %s", name, out_path)

            if progress_callback:
                progress_callback(1.0)
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

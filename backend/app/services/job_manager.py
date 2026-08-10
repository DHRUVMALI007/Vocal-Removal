from __future__ import annotations

import asyncio
import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.config import Settings, get_settings
from app.models.schemas import (
    JobMetadata,
    JobStatus,
    LyricsData,
    ProcessingStep,
    SeparationOptions,
    StemInfo,
)
from app.services.ffmpeg_utils import convert_to_wav, get_audio_duration
from app.services.lyrics_formatter import export_lyrics
from app.services.stem_separator import (
    CORE_STEMS,
    DEMUCS_STEM_LABELS,
    INSTRUMENTAL_SOURCE_STEMS,
    DemucsSeparator,
    StemSeparator,
    create_instrumental_stem,
    create_zip_archive,
)
from app.services.transcription_service import TranscriptionService, WhisperTranscriptionService

logger = logging.getLogger(__name__)

STEM_OUTPUT_ORDER = ("vocals", "drums", "bass", "other")


class JobManager:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.temp_dir = Path(self.settings.temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self._tasks: dict[str, asyncio.Task] = {}
        self._separator: StemSeparator = DemucsSeparator(
            model_name=self.settings.demucs_model,
            device=self.settings.device,
            overlap=self.settings.demucs_overlap,
            shifts=self.settings.demucs_shifts,
        )
        self._transcriber: TranscriptionService = WhisperTranscriptionService(
            model_size=self.settings.whisper_model,
            device=self.settings.effective_whisper_device,
            compute_type=self.settings.whisper_compute_type,
            beam_size=self.settings.whisper_beam_size,
            vad_min_silence_ms=self.settings.whisper_vad_min_silence_ms,
            condition_on_previous_text=self.settings.whisper_condition_on_previous_text,
        )

    def job_dir(self, job_id: str) -> Path:
        return self.temp_dir / job_id

    def metadata_path(self, job_id: str) -> Path:
        return self.job_dir(job_id) / "metadata.json"

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def load_metadata(self, job_id: str) -> JobMetadata | None:
        path = self.metadata_path(job_id)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return JobMetadata(**data)

    def save_metadata(self, meta: JobMetadata) -> None:
        meta.updated_at = self._now()
        path = self.metadata_path(meta.job_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(".json.tmp")
        temp_path.write_text(meta.model_dump_json(indent=2), encoding="utf-8")
        temp_path.replace(path)

    def create_job(self, original_filename: str, input_path: Path) -> JobMetadata:
        job_id = str(uuid.uuid4())
        job_path = self.job_dir(job_id)
        job_path.mkdir(parents=True, exist_ok=True)

        meta = JobMetadata(
            job_id=job_id,
            status=JobStatus.CREATED,
            original_filename=original_filename,
            input_file=input_path.name,
            created_at=self._now(),
            updated_at=self._now(),
        )
        self.save_metadata(meta)
        logger.info("Created job %s", job_id)
        return meta

    def update_progress(
        self,
        job_id: str,
        progress: float,
        step: ProcessingStep | None = None,
        message: str = "",
        status: JobStatus | None = None,
    ) -> JobMetadata:
        meta = self.load_metadata(job_id)
        if meta is None:
            raise ValueError(f"Job {job_id} not found")
        meta.progress = min(max(progress, 0.0), 100.0)
        if step:
            meta.step = step
        if message:
            meta.message = message
        if status:
            meta.status = status
        self.save_metadata(meta)
        return meta

    def _required_demucs_stems(self, meta: JobMetadata) -> set[str]:
        requested = set(meta.requested_outputs)
        required = requested.intersection(CORE_STEMS)
        if "instrumental" in requested:
            required.update(INSTRUMENTAL_SOURCE_STEMS)
        if meta.include_lyrics:
            required.add("vocals")
        return required

    async def run_separation(self, job_id: str) -> JobMetadata:
        meta = self.load_metadata(job_id)
        if meta is None:
            raise ValueError(f"Job {job_id} not found")

        try:
            meta.status = JobStatus.PROCESSING
            meta.error = None
            meta.lyrics = None
            meta.step = ProcessingStep.NORMALIZE
            meta.message = "Preparing audio"
            meta.progress = 10.0
            self.save_metadata(meta)

            job_path = self.job_dir(job_id)
            input_file = job_path / meta.input_file
            normalized = job_path / "input.wav"
            convert_to_wav(input_file, normalized)
            meta.duration_seconds = get_audio_duration(normalized)
            meta.progress = 20.0
            self.save_metadata(meta)

            meta.step = ProcessingStep.SEPARATE
            meta.message = "Separating requested audio"
            meta.progress = 30.0
            meta.separation_model = self.settings.demucs_model
            self.save_metadata(meta)

            required_stems = self._required_demucs_stems(meta)
            stems_dir = job_path / "stems"
            progress_guard = {"value": 0.0}

            def separation_progress(fraction: float) -> None:
                # Demucs runs in a worker thread. Throttle metadata writes while
                # still giving the UI useful progress during the longest stage.
                fraction = max(0.0, min(1.0, fraction))
                if fraction < 1.0 and fraction - progress_guard["value"] < 0.035:
                    return
                progress_guard["value"] = fraction
                self.update_progress(
                    job_id,
                    30.0 + fraction * 30.0,
                    step=ProcessingStep.SEPARATE,
                    message=f"Separating the mix · {round(fraction * 100)}%",
                    status=JobStatus.PROCESSING,
                )

            stem_paths = await self._separator.separate(
                normalized,
                stems_dir,
                required_stems=required_stems,
                progress_callback=separation_progress,
            )

            meta.progress = 60.0
            self.save_metadata(meta)

            requested = set(meta.requested_outputs)
            instrumental_path: Path | None = None
            if "instrumental" in requested:
                meta.step = ProcessingStep.INSTRUMENTAL
                meta.message = "Creating instrumental"
                meta.progress = 70.0
                self.save_metadata(meta)

                instrumental_path = job_path / "instrumental.wav"
                create_instrumental_stem(stem_paths, instrumental_path)

            stem_infos: list[StemInfo] = []
            for name in STEM_OUTPUT_ORDER:
                if name not in requested:
                    continue
                path = stem_paths.get(name)
                if path is None:
                    raise RuntimeError(f"Requested stem was not produced: {name}")
                stem_infos.append(
                    StemInfo(
                        name=name,
                        label=DEMUCS_STEM_LABELS.get(name, name.title()),
                        filename=path.name,
                    )
                )

            if instrumental_path is not None:
                stem_infos.append(
                    StemInfo(
                        name="instrumental",
                        label="Instrumental / Karaoke",
                        filename=instrumental_path.name,
                    )
                )

            meta.stems = stem_infos
            meta.progress = 75.0 if meta.include_lyrics else 90.0
            meta.message = "Separation complete"
            self.save_metadata(meta)
            return meta

        except Exception as exc:
            logger.exception("Separation failed for job %s", job_id)
            meta.status = JobStatus.FAILED
            meta.error = str(exc)
            meta.message = "Separation failed"
            self.save_metadata(meta)
            raise

    async def run_transcription(self, job_id: str) -> JobMetadata:
        meta = self.load_metadata(job_id)
        if meta is None:
            raise ValueError(f"Job {job_id} not found")

        try:
            meta.step = ProcessingStep.TRANSCRIBE
            meta.message = "Transcribing vocals literally"
            meta.progress = max(meta.progress, 80.0)
            meta.transcription_model = self.settings.whisper_model
            self.save_metadata(meta)

            job_path = self.job_dir(job_id)
            vocals_path = job_path / "stems" / "vocals.wav"
            if not vocals_path.exists():
                raise FileNotFoundError("Vocal stem not found. Run separation first.")

            configured_language = self.settings.whisper_language.strip() or None
            requested_language = meta.requested_language
            language = configured_language or (None if requested_language == "auto" else requested_language)
            language_label = {"en": "English", "hi": "Hindi", "gu": "Gujarati"}.get(language or "", "Auto detect")
            meta.message = f"Literal transcription · {language_label}"
            self.save_metadata(meta)

            # First pass is always the literal ASR result. Whisper is explicitly
            # called with task=transcribe, so no translation/grammar cleanup is
            # performed by this application.
            transcription = await self._transcriber.transcribe(vocals_path, language=language)
            display_transcription = transcription
            original_lines = []
            original_files: dict[str, str] = {}

            meta.detected_language = transcription.language
            meta.language_probability = transcription.language_probability
            meta.transcript_language_used = language or transcription.language

            # Hindi and Urdu speech can be ambiguous to automatic language
            # detection. If Auto specifically comes back as Urdu and the user
            # asked for an Indic script fallback, keep the raw auto transcript
            # and re-decode the SAME audio with the requested language token.
            # This is speech recognition again, not translation or paraphrasing.
            fallback = meta.urdu_script_fallback
            should_redecode = (
                language is None
                and transcription.language == "ur"
                and fallback in {"hi", "gu"}
            )
            if should_redecode:
                fallback_label = "Hindi / Devanagari" if fallback == "hi" else "Gujarati"
                meta.message = f"Urdu detected · re-decoding as {fallback_label}"
                meta.progress = max(meta.progress, 86.0)
                self.save_metadata(meta)
                try:
                    fallback_transcription = await self._transcriber.transcribe(
                        vocals_path,
                        language=fallback,
                    )
                    if fallback_transcription.lines:
                        original_lines = transcription.lines
                        display_transcription = fallback_transcription
                        meta.transcript_language_used = fallback
                    else:
                        logger.warning(
                            "Preferred-script re-decode returned no lines for job %s; keeping original transcript",
                            job_id,
                        )
                except Exception:
                    # Script preference is optional. Never throw away a valid raw
                    # transcript because a second preference decode failed.
                    logger.exception(
                        "Preferred-script re-decode failed for job %s; keeping original transcript",
                        job_id,
                    )

            lines = display_transcription.lines

            meta.step = ProcessingStep.LYRICS
            meta.message = "Preparing synchronized literal lyrics"
            meta.progress = 92.0
            self.save_metadata(meta)

            files = export_lyrics(lines, job_path) if lines else {}
            if original_lines:
                original_files = export_lyrics(original_lines, job_path, basename="lyrics_original")

            meta.lyrics = LyricsData(
                lines=lines,
                original_lines=original_lines,
                txt_file=files.get("txt_file"),
                srt_file=files.get("srt_file"),
                lrc_file=files.get("lrc_file"),
                original_txt_file=original_files.get("txt_file"),
                original_srt_file=original_files.get("srt_file"),
                original_lrc_file=original_files.get("lrc_file"),
            )
            meta.step = ProcessingStep.FINALIZE
            meta.message = "Finalizing"
            meta.progress = 98.0
            self.save_metadata(meta)

            meta.status = JobStatus.COMPLETED
            meta.progress = 100.0
            meta.message = "Completed" if lines else "Completed (no lyrics detected)"
            self.save_metadata(meta)
            return meta

        except Exception as exc:
            logger.exception("Transcription failed for job %s", job_id)
            meta.status = JobStatus.FAILED
            meta.error = str(exc)
            meta.message = "Transcription failed"
            self.save_metadata(meta)
            raise

    def _complete_without_transcription(self, job_id: str) -> None:
        meta = self.load_metadata(job_id)
        if not meta:
            return
        meta.step = ProcessingStep.FINALIZE
        meta.message = "Finalizing selected outputs"
        meta.progress = 98.0
        self.save_metadata(meta)
        meta.status = JobStatus.COMPLETED
        meta.progress = 100.0
        meta.message = "Completed"
        self.save_metadata(meta)

    def _cleanup_internal_stems(self, job_id: str) -> None:
        """Delete stems created only as dependencies, not requested by the user."""
        meta = self.load_metadata(job_id)
        if not meta:
            return
        requested = set(meta.requested_outputs)
        stems_dir = self.job_dir(job_id) / "stems"
        if not stems_dir.exists():
            return

        for name in CORE_STEMS:
            if name in requested:
                continue
            path = stems_dir / f"{name}.wav"
            if path.exists():
                path.unlink()
                logger.info("Removed internal-only stem for job %s: %s", job_id, name)

        try:
            if not any(stems_dir.iterdir()):
                stems_dir.rmdir()
        except OSError:
            pass

    async def run_full_pipeline(self, job_id: str) -> None:
        async def _pipeline() -> None:
            await self.run_separation(job_id)
            meta = self.load_metadata(job_id)
            if not meta:
                raise ValueError(f"Job {job_id} not found")
            if meta.include_lyrics:
                await self.run_transcription(job_id)
            else:
                self._complete_without_transcription(job_id)
            self._cleanup_internal_stems(job_id)

        try:
            await asyncio.wait_for(
                _pipeline(),
                timeout=self.settings.processing_timeout_seconds,
            )
        except TimeoutError:
            logger.error(
                "Processing timed out for job %s after %s seconds",
                job_id,
                self.settings.processing_timeout_seconds,
            )
            meta = self.load_metadata(job_id)
            if meta:
                meta.status = JobStatus.FAILED
                meta.error = (
                    f"Processing timed out after "
                    f"{self.settings.processing_timeout_seconds} seconds"
                )
                meta.message = "Processing timed out"
                self.save_metadata(meta)
        except Exception:
            pass  # service methods already save the processing error in metadata

    def start_pipeline(self, job_id: str, options: SeparationOptions | None = None) -> None:
        if job_id in self._tasks and not self._tasks[job_id].done():
            return
        meta = self.load_metadata(job_id)
        if meta:
            selected = options or SeparationOptions()
            meta.requested_outputs = list(selected.outputs)
            meta.include_lyrics = selected.include_lyrics
            meta.requested_language = selected.transcription_language
            meta.urdu_script_fallback = selected.urdu_script_fallback
            meta.detected_language = None
            meta.language_probability = None
            meta.transcript_language_used = None
            meta.status = JobStatus.QUEUED
            meta.message = "Queued for processing"
            meta.progress = 0.0
            meta.error = None
            self.save_metadata(meta)
        self._tasks[job_id] = asyncio.create_task(self.run_full_pipeline(job_id))

    def delete_job(self, job_id: str) -> bool:
        job_path = self.job_dir(job_id)
        if job_path.exists():
            shutil.rmtree(job_path, ignore_errors=True)
        task = self._tasks.pop(job_id, None)
        if task and not task.done():
            task.cancel()
        logger.info("Deleted job %s", job_id)
        return True

    def build_download_urls(self, job_id: str) -> dict[str, str]:
        meta = self.load_metadata(job_id)
        if not meta:
            return {}
        urls: dict[str, str] = {}
        for stem in meta.stems:
            urls[stem.name] = f"/api/jobs/{job_id}/download/{stem.filename}"
        if meta.lyrics:
            if meta.lyrics.txt_file:
                urls["lyrics_txt"] = f"/api/jobs/{job_id}/download/{meta.lyrics.txt_file}"
            if meta.lyrics.srt_file:
                urls["lyrics_srt"] = f"/api/jobs/{job_id}/download/{meta.lyrics.srt_file}"
            if meta.lyrics.lrc_file:
                urls["lyrics_lrc"] = f"/api/jobs/{job_id}/download/{meta.lyrics.lrc_file}"
            if meta.lyrics.original_txt_file:
                urls["lyrics_original_txt"] = f"/api/jobs/{job_id}/download/{meta.lyrics.original_txt_file}"
            if meta.lyrics.original_srt_file:
                urls["lyrics_original_srt"] = f"/api/jobs/{job_id}/download/{meta.lyrics.original_srt_file}"
            if meta.lyrics.original_lrc_file:
                urls["lyrics_original_lrc"] = f"/api/jobs/{job_id}/download/{meta.lyrics.original_lrc_file}"
        urls["all_zip"] = f"/api/jobs/{job_id}/download/all.zip"
        return urls

    def _resolve_stem_path(self, job_path: Path, stem: StemInfo) -> Path | None:
        if stem.name == "instrumental":
            p = job_path / stem.filename
        elif (job_path / "stems" / stem.filename).exists():
            p = job_path / "stems" / stem.filename
        else:
            p = job_path / stem.filename
        return p if p.exists() else None

    def _allowed_result_filenames(self, meta: JobMetadata) -> set[str]:
        allowed = {stem.filename for stem in meta.stems}
        if meta.lyrics:
            for filename in (
                meta.lyrics.txt_file,
                meta.lyrics.srt_file,
                meta.lyrics.lrc_file,
                meta.lyrics.original_txt_file,
                meta.lyrics.original_srt_file,
                meta.lyrics.original_lrc_file,
            ):
                if filename:
                    allowed.add(filename)
        return allowed

    def get_downloadable_file(self, job_id: str, filename: str) -> Path | None:
        job_path = self.job_dir(job_id)
        meta = self.load_metadata(job_id)
        if not meta:
            return None

        if filename == "all.zip":
            files: list[Path] = []
            for stem in meta.stems:
                p = self._resolve_stem_path(job_path, stem)
                if p:
                    files.append(p)
            if meta.lyrics:
                for lf in [
                    meta.lyrics.txt_file,
                    meta.lyrics.srt_file,
                    meta.lyrics.lrc_file,
                    meta.lyrics.original_txt_file,
                    meta.lyrics.original_srt_file,
                    meta.lyrics.original_lrc_file,
                ]:
                    if lf and (job_path / lf).exists():
                        files.append(job_path / lf)
            zip_path = job_path / "all.zip"
            create_zip_archive(job_path, files, zip_path)
            return zip_path

        safe_name = Path(filename).name
        if safe_name not in self._allowed_result_filenames(meta):
            return None

        for candidate in [job_path / safe_name, job_path / "stems" / safe_name]:
            if candidate.exists() and candidate.resolve().is_relative_to(job_path.resolve()):
                return candidate
        return None

    async def cleanup_expired_jobs(self) -> int:
        from datetime import timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(hours=self.settings.job_ttl_hours)
        removed = 0
        if not self.temp_dir.exists():
            return 0
        for job_path in self.temp_dir.iterdir():
            if not job_path.is_dir():
                continue
            meta_path = job_path / "metadata.json"
            if not meta_path.exists():
                shutil.rmtree(job_path, ignore_errors=True)
                removed += 1
                continue
            try:
                meta = JobMetadata(**json.loads(meta_path.read_text(encoding="utf-8")))
                created = datetime.fromisoformat(meta.created_at)
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                if created < cutoff:
                    self.delete_job(meta.job_id)
                    removed += 1
            except Exception:
                shutil.rmtree(job_path, ignore_errors=True)
                removed += 1
        if removed:
            logger.info("Cleaned up %d expired jobs", removed)
        return removed


_job_manager: JobManager | None = None


def get_job_manager() -> JobManager:
    global _job_manager
    if _job_manager is None:
        _job_manager = JobManager()
    return _job_manager

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import get_settings
from app.models.schemas import (
    JobCreateResponse,
    JobMetadata,
    JobResultsResponse,
    JobStatus,
    JobStatusResponse,
    SeparationOptions,
)
from app.services.job_manager import get_job_manager
from app.utils.security import is_safe_path, sanitize_filename, validate_extension, validate_mime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/jobs", tags=["jobs"])
settings = get_settings()
manager = get_job_manager()


@router.post("", response_model=JobCreateResponse)
async def create_job(file: UploadFile = File(...)) -> JobCreateResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    if not validate_extension(file.filename, settings.allowed_ext_set):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(settings.allowed_ext_set))}",
        )

    if not validate_mime(file.content_type, settings.allowed_ext_set):
        raise HTTPException(status_code=400, detail="Unsupported MIME type")

    safe_name = sanitize_filename(file.filename)

    job_id = str(uuid.uuid4())
    job_path = manager.job_dir(job_id)
    job_path.mkdir(parents=True, exist_ok=True)

    input_path = job_path / f"input{Path(safe_name).suffix.lower()}"
    total_bytes = 0
    chunk_size = 1024 * 1024

    try:
        with input_path.open("wb") as output:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > settings.max_upload_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max size: {settings.max_upload_size_mb} MB",
                    )
                output.write(chunk)
    except HTTPException:
        manager.delete_job(job_id)
        raise
    except Exception as exc:
        manager.delete_job(job_id)
        logger.exception("Upload failed for job %s", job_id)
        raise HTTPException(status_code=500, detail="Could not save uploaded audio") from exc

    if total_bytes == 0:
        manager.delete_job(job_id)
        raise HTTPException(status_code=400, detail="File is empty")

    now = datetime.now(timezone.utc).isoformat()
    meta = JobMetadata(
        job_id=job_id,
        status=JobStatus.CREATED,
        original_filename=safe_name,
        input_file=input_path.name,
        created_at=now,
        updated_at=now,
    )
    manager.save_metadata(meta)

    logger.info("Uploaded file for job %s: %s (%d bytes)", job_id, safe_name, total_bytes)
    return JobCreateResponse(job_id=job_id, status=JobStatus.CREATED)


@router.post("/{job_id}/separate", response_model=JobStatusResponse)
async def start_separation(
    job_id: str,
    options: SeparationOptions | None = None,
) -> JobStatusResponse:
    meta = manager.load_metadata(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Job not found")
    if meta.status in (JobStatus.PROCESSING, JobStatus.QUEUED):
        return _status_response(meta)
    manager.start_pipeline(job_id, options)
    meta = manager.load_metadata(job_id)
    return _status_response(meta)


@router.post("/{job_id}/transcribe", response_model=JobStatusResponse)
async def start_transcription(job_id: str) -> JobStatusResponse:
    meta = manager.load_metadata(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Job not found")
    vocals_path = manager.job_dir(job_id) / "stems" / "vocals.wav"
    if not vocals_path.exists():
        raise HTTPException(
            status_code=400,
            detail="Vocal stem is not available. Select Vocals or enable Lyrics when starting separation.",
        )
    if meta.status == JobStatus.PROCESSING:
        return _status_response(meta)

    import asyncio

    meta.status = JobStatus.PROCESSING
    manager.save_metadata(meta)
    asyncio.create_task(manager.run_transcription(job_id))
    meta = manager.load_metadata(job_id)
    return _status_response(meta)


@router.get("/{job_id}/status", response_model=JobStatusResponse)
async def get_status(job_id: str) -> JobStatusResponse:
    meta = manager.load_metadata(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Job not found")
    return _status_response(meta)


@router.get("/{job_id}/results", response_model=JobResultsResponse)
async def get_results(job_id: str) -> JobResultsResponse:
    meta = manager.load_metadata(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResultsResponse(
        job_id=job_id,
        status=meta.status,
        duration_seconds=meta.duration_seconds,
        stems=meta.stems,
        lyrics=meta.lyrics,
        download_urls=manager.build_download_urls(job_id),
        metadata={
            "separation_model": meta.separation_model,
            "transcription_model": meta.transcription_model,
            "original_filename": meta.original_filename,
            "requested_outputs": meta.requested_outputs,
            "include_lyrics": meta.include_lyrics,
            "requested_language": meta.requested_language,
            "detected_language": "hi" if meta.detected_language == "ur" else meta.detected_language,
            "language_probability": meta.language_probability,
            "transcript_language_used": meta.transcript_language_used,
            "literal_transcription": True,
        },
    )


@router.get("/{job_id}/download/{filename}")
async def download_file(job_id: str, filename: str) -> FileResponse:
    meta = manager.load_metadata(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Job not found")

    safe_name = Path(filename).name
    file_path = manager.get_downloadable_file(job_id, safe_name)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    job_path = manager.job_dir(job_id)
    if not is_safe_path(job_path, file_path):
        raise HTTPException(status_code=403, detail="Access denied")

    media_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".txt": "text/plain",
        ".srt": "application/x-subrip",
        ".lrc": "text/plain",
        ".zip": "application/zip",
    }
    media_type = media_types.get(file_path.suffix.lower(), "application/octet-stream")
    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type=media_type,
    )


@router.delete("/{job_id}")
async def delete_job(job_id: str) -> dict:
    meta = manager.load_metadata(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Job not found")
    manager.delete_job(job_id)
    return {"deleted": True, "job_id": job_id}


def _status_response(meta: JobMetadata) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=meta.job_id,
        status=meta.status,
        progress=meta.progress,
        step=meta.step,
        message=meta.message,
        error=meta.error,
    )

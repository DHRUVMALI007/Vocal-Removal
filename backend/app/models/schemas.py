from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class JobStatus(str, Enum):
    CREATED = "created"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProcessingStep(str, Enum):
    UPLOAD = "upload"
    NORMALIZE = "normalize"
    SEPARATE = "separate"
    INSTRUMENTAL = "instrumental"
    TRANSCRIBE = "transcribe"
    LYRICS = "lyrics"
    FINALIZE = "finalize"


StemOutputName = Literal["vocals", "drums", "bass", "other", "instrumental"]
TranscriptionLanguage = Literal["en", "hi", "gu"]
DEFAULT_OUTPUTS: list[StemOutputName] = [
    "vocals",
    "drums",
    "bass",
    "other",
    "instrumental",
]


class SeparationOptions(BaseModel):
    outputs: list[StemOutputName] = Field(default_factory=lambda: list(DEFAULT_OUTPUTS))
    include_lyrics: bool = True
    transcription_language: TranscriptionLanguage = "en"

    @model_validator(mode="after")
    def validate_selection(self) -> "SeparationOptions":
        # Keep order stable while removing duplicate selections.
        self.outputs = list(dict.fromkeys(self.outputs))
        if not self.outputs and not self.include_lyrics:
            raise ValueError("Select at least one stem or enable lyrics")
        return self


class StemInfo(BaseModel):
    name: str
    label: str
    filename: str
    available: bool = True


class LyricLine(BaseModel):
    start: float
    end: float
    text: str


class LyricsData(BaseModel):
    # `lines` is what Studio displays. Original fields remain only for loading
    # older metadata safely and are no longer exposed by the current UI.
    lines: list[LyricLine] = Field(default_factory=list)
    original_lines: list[LyricLine] = Field(default_factory=list)
    txt_file: str | None = None
    srt_file: str | None = None
    lrc_file: str | None = None
    original_txt_file: str | None = None
    original_srt_file: str | None = None
    original_lrc_file: str | None = None


class JobMetadata(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.CREATED
    original_filename: str
    input_file: str
    created_at: str
    updated_at: str
    progress: float = 0.0
    step: ProcessingStep | None = None
    message: str = ""
    error: str | None = None
    duration_seconds: float | None = None
    stems: list[StemInfo] = Field(default_factory=list)
    lyrics: LyricsData | None = None
    separation_model: str | None = None
    transcription_model: str | None = None
    requested_outputs: list[StemOutputName] = Field(default_factory=lambda: list(DEFAULT_OUTPUTS))
    include_lyrics: bool = True
    requested_language: TranscriptionLanguage = "en"
    detected_language: str | None = None
    language_probability: float | None = None
    transcript_language_used: str | None = None


class JobCreateResponse(BaseModel):
    job_id: str
    status: JobStatus


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: float = 0.0
    step: ProcessingStep | None = None
    message: str = ""
    error: str | None = None


class JobResultsResponse(BaseModel):
    job_id: str
    status: JobStatus
    duration_seconds: float | None = None
    stems: list[StemInfo] = Field(default_factory=list)
    lyrics: LyricsData | None = None
    download_urls: dict[str, str] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

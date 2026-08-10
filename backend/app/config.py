from functools import lru_cache
from pathlib import Path

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    temp_dir: Path = Path("./temp")
    job_ttl_hours: int = Field(default=2, validation_alias=AliasChoices("TEMP_JOB_TTL_HOURS", "JOB_TTL_HOURS"))
    max_upload_size_mb: int = Field(default=200, validation_alias=AliasChoices("MAX_UPLOAD_MB", "MAX_UPLOAD_SIZE_MB"))
    allowed_extensions: str = "mp3,wav,flac,m4a,ogg,aac"
    processing_timeout_seconds: int = 600
    cors_origins: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices("ALLOWED_ORIGINS", "CORS_ORIGINS"),
    )

    demucs_model: str = Field(default="htdemucs", validation_alias=AliasChoices("SEPARATION_MODEL", "DEMUCS_MODEL"))
    whisper_model: str = Field(default="large-v3", validation_alias=AliasChoices("WHISPER_MODEL"))
    device: str = Field(default="auto", validation_alias=AliasChoices("AI_DEVICE", "DEVICE"))
    whisper_device: str = "auto"
    whisper_compute_type: str = "auto"
    whisper_language: str = ""

    @property
    def allowed_ext_set(self) -> set[str]:
        return {ext.strip().lower() for ext in self.allowed_extensions.split(",") if ext.strip()}

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def effective_whisper_device(self) -> str:
        if self.whisper_device != "auto":
            return self.whisper_device
        return self.device if self.device != "auto" else "auto"


@lru_cache
def get_settings() -> Settings:
    return Settings()

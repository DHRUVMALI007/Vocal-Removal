from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.jobs import router as jobs_router
from app.config import get_settings
from app.services.job_manager import get_job_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


async def _cleanup_loop() -> None:
    manager = get_job_manager()
    while True:
        try:
            await manager.cleanup_expired_jobs()
        except Exception:
            logger.exception("Cleanup task error")
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    cleanup_task = asyncio.create_task(_cleanup_loop())
    logger.info("Vocal Manager backend started")
    yield
    cleanup_task.cancel()
    logger.info("Vocal Manager backend stopped")


app = FastAPI(
    title="Vocal Manager API",
    description="AI music vocal removal, stem separation, and lyrics transcription",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "vocal-manager"}

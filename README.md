# Vocal Manager

AI-powered music vocal removal, stem separation, lyrics transcription, and karaoke/singing practice — full-stack web app with no database or auth (MVP).

## Features

- **Upload** audio (MP3, WAV, FLAC, M4A, OGG, AAC)
- **AI stem separation** via HTDemucs (vocals, drums, bass, other + instrumental mix)
- **Lyrics transcription** from isolated vocal stem using faster-whisper
- **Synchronized lyrics** with click-to-seek and line highlighting
- **Stem mixer** — mute, solo, volume per channel
- **Karaoke mode** — instrumental playback with vocals muted
- **Playback speed** control (0.5x / 0.75x / 1x) via Web Audio API
- **Loop sections** by clicking two lyric lines
- **Downloads** — individual stems, lyrics (TXT/SRT/LRC), or ZIP
- **Auto cleanup** of temporary jobs after configurable TTL

### Limitations (by design)

- HTDemucs outputs **4 stems**: vocals, drums, bass, other. No dedicated guitar/tabla stems unless you add a specialized model via the `StemSeparator` interface.
- Separation quality varies by song — not guaranteed 100% accurate.
- Pitch-preserving speed change is browser-side (Web Audio `playbackRate`); extreme speeds may affect quality.

## Architecture

```
frontend/          Vite + React + TypeScript + Tailwind + WaveSurfer.js
backend/           FastAPI + Demucs + faster-whisper + FFmpeg
temp/{job_id}/     Temporary job storage (no database)
```

## Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **FFmpeg** installed and on PATH
- **GPU (optional)** — CUDA accelerates Demucs and Whisper

## Quick Start (Development)

### 1. Clone and configure

```bash
cp .env.example .env
```

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs` | Upload audio, create job |
| POST | `/api/jobs/{id}/separate` | Start separation + transcription pipeline |
| POST | `/api/jobs/{id}/transcribe` | Transcribe vocals only |
| GET | `/api/jobs/{id}/status` | Job status and progress |
| GET | `/api/jobs/{id}/results` | Stems, lyrics, download URLs |
| GET | `/api/jobs/{id}/download/{file}` | Download a result file |
| DELETE | `/api/jobs/{id}` | Delete job and temp files |

## Environment Variables

See [`.env.example`](.env.example):

| Variable | Default | Description |
|----------|---------|-------------|
| `TEMP_DIR` | `./temp` | Temporary job storage |
| `JOB_TTL_HOURS` | `24` | Auto-delete jobs after N hours |
| `MAX_UPLOAD_SIZE_MB` | `100` | Upload size limit |
| `DEMUCS_MODEL` | `htdemucs` | Separation model |
| `WHISPER_MODEL` | `base` | Whisper model size |
| `DEVICE` | `auto` | `cuda`, `cpu`, or `auto` |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins |

## Production Notes

- Set `CORS_ORIGINS` to your production domain.
- Use a reverse proxy (nginx/Caddy) for HTTPS and file size limits.
- Mount persistent volume for `temp/` or replace with S3 + database later.
- For GPU servers, install CUDA-enabled PyTorch and set `DEVICE=cuda`.
- Consider larger Whisper models (`small`, `medium`) for better lyrics accuracy.
- Add Redis/Celery for job queue at scale.
- Auth and persistent storage can plug in without changing the core service interfaces.

## Extending

- **`StemSeparator`** — implement in `backend/app/services/stem_separator.py` for new models (e.g. guitar-specific).
- **`TranscriptionService`** — swap Whisper for other STT engines.
- **`InstrumentSeparator`** — future service for tabla/guitar when models are added.

## License

MIT

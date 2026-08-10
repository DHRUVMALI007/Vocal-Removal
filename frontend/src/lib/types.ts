export type JobStatus = "created" | "queued" | "processing" | "completed" | "failed";

export type ProcessingStep = "upload" | "normalize" | "separate" | "transcribe" | "finalize";

export interface StemInfo {
  name: string;
  label: string;
  filename: string;
  available: boolean;
}

export interface LyricLine {
  start: number;
  end: number;
  text: string;
}

export interface LyricsData {
  lines: LyricLine[];
  txt_file: string | null;
  srt_file: string | null;
  lrc_file: string | null;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: number;
  step: ProcessingStep | null;
  message: string;
  error: string | null;
}

export interface JobResultsResponse {
  job_id: string;
  status: JobStatus;
  duration_seconds: number | null;
  stems: StemInfo[];
  lyrics: LyricsData | null;
  download_urls: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface StemChannelState {
  name: string;
  label: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  url: string;
}

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

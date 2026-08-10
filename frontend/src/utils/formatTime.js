export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const STAGE_LABELS = {
  upload: "Uploading",
  normalize: "Preparing audio",
  separate: "Separating stems",
  instrumental: "Creating instrumental",
  transcribe: "Transcribing vocals",
  lyrics: "Preparing lyrics",
  finalize: "Finalizing",
  created: "Uploading",
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

export function getStageLabel(status) {
  if (status.step && STAGE_LABELS[status.step]) return STAGE_LABELS[status.step];
  if (status.message) return status.message;
  if (status.status && STAGE_LABELS[status.status]) return STAGE_LABELS[status.status];
  return "Processing";
}

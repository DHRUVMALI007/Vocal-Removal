import { formatFileSize } from "../utils/formatTime";

const ACCEPT = "audio/mpeg,audio/wav,audio/flac,audio/mp4,audio/ogg,.mp3,.wav,.flac,.m4a,.ogg";
const ALLOWED = ["mp3", "wav", "flac", "m4a", "ogg"];
const MAX_MB = 200;

export default function UploadDropzone({ onUpload, disabled, pendingFile }) {
  const validate = (file) => {
    if (!file) return "No file selected";
    if (file.size === 0) return "File is empty";
    if (file.size > MAX_MB * 1024 * 1024) return `File exceeds ${MAX_MB} MB limit`;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED.includes(ext)) return `Unsupported format. Use: ${ALLOWED.join(", ")}`;
    return null;
  };

  const handleFile = (file) => {
    const err = validate(file);
    if (err) {
      onUpload(null, err);
      return;
    }
    onUpload(file, null);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <label
        className={`card flex cursor-pointer flex-col items-center gap-4 border-dashed py-12 sm:py-16 transition ${
          disabled ? "pointer-events-none opacity-50" : "hover:border-accent/40"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent/30 to-blue-500/20">
          <svg className="h-7 w-7 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div className="text-center px-4">
          <p className="text-lg font-medium">Drop your song here or click to browse</p>
          <p className="mt-1 text-sm text-gray-400">MP3, WAV, FLAC, M4A, OGG — up to {MAX_MB} MB</p>
        </div>
        {pendingFile && (
          <p className="text-sm text-accent-light">
            {pendingFile.name} · {formatFileSize(pendingFile.size)}
          </p>
        )}
        <span className="btn-primary">Upload Audio</span>
        <input
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>
    </div>
  );
}

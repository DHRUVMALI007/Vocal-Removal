"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

const ACCEPT = "audio/mpeg,audio/wav,audio/flac,audio/mp4,audio/ogg,audio/aac,.mp3,.wav,.flac,.m4a,.ogg,.aac";
const MAX_MB = 100;

export default function UploadZone({ onUpload, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (file.size > MAX_MB * 1024 * 1024) return `File exceeds ${MAX_MB} MB limit`;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["mp3", "wav", "flac", "m4a", "ogg", "aac"];
    if (!ext || !allowed.includes(ext)) return `Unsupported format. Use: ${allowed.join(", ")}`;
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onUpload(file);
    },
    [onUpload],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload audio file"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`card flex cursor-pointer flex-col items-center gap-4 border-dashed py-16 transition ${
          dragging ? "border-accent bg-accent/5" : "hover:border-accent/40"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent/30 to-blue-500/30">
          <svg className="h-8 w-8 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium">Drop your song here or click to browse</p>
          <p className="mt-1 text-sm text-gray-400">MP3, WAV, FLAC, M4A, OGG, AAC — up to {MAX_MB} MB</p>
        </div>
        <button type="button" className="btn-primary" disabled={disabled}>
          Upload Audio
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

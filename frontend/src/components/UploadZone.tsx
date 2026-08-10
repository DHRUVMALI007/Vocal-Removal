"use client";

import { useCallback, useRef, useState } from "react";
import type { OutputStem, SeparationOptions } from "@/lib/types";

interface UploadZoneProps {
  onUpload: (file: File, options: SeparationOptions) => void;
  disabled?: boolean;
}

const ACCEPT = "audio/mpeg,audio/wav,audio/flac,audio/mp4,audio/ogg,audio/aac,.mp3,.wav,.flac,.m4a,.ogg,.aac";
const MAX_MB = 100;

const OUTPUTS: Array<{ name: OutputStem; label: string; help: string }> = [
  { name: "vocals", label: "Vocals", help: "Isolated singing voice" },
  { name: "instrumental", label: "Instrumental", help: "Music without vocals" },
  { name: "drums", label: "Drums", help: "Drums and percussion" },
  { name: "bass", label: "Bass", help: "Bass stem" },
  { name: "other", label: "Other", help: "Remaining accompaniment" },
];

const DEFAULT_OUTPUTS: OutputStem[] = ["vocals", "instrumental"];

export default function UploadZone({ onUpload, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputStem[]>(DEFAULT_OUTPUTS);
  const [includeLyrics, setIncludeLyrics] = useState(true);

  const validate = (file: File): string | null => {
    if (file.size > MAX_MB * 1024 * 1024) return `File exceeds ${MAX_MB} MB limit`;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["mp3", "wav", "flac", "m4a", "ogg", "aac"];
    if (!ext || !allowed.includes(ext)) return `Unsupported format. Use: ${allowed.join(", ")}`;
    if (outputs.length === 0 && !includeLyrics) return "Select at least one output or Lyrics";
    return null;
  };

  const toggleOutput = (name: OutputStem) => {
    setOutputs((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
    setError(null);
  };

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onUpload(file, { outputs, include_lyrics: includeLyrics });
    },
    [includeLyrics, onUpload, outputs],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Choose what you want</h2>
            <p className="mt-1 text-sm text-gray-400">Only selected outputs will be returned and downloadable.</p>
          </div>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              setOutputs(OUTPUTS.map((item) => item.name));
              setIncludeLyrics(true);
              setError(null);
            }}
          >
            Select all
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OUTPUTS.map((item) => {
            const checked = outputs.includes(item.name);
            return (
              <label
                key={item.name}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  checked
                    ? "border-accent/70 bg-accent/10"
                    : "border-surface-border bg-surface-elevated hover:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleOutput(item.name)}
                    className="mt-1 h-4 w-4 accent-purple-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.help}</p>
                  </div>
                </div>
              </label>
            );
          })}

          <label
            className={`cursor-pointer rounded-lg border p-3 transition ${
              includeLyrics
                ? "border-accent/70 bg-accent/10"
                : "border-surface-border bg-surface-elevated hover:border-gray-600"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={includeLyrics}
                disabled={disabled}
                onChange={(e) => {
                  setIncludeLyrics(e.target.checked);
                  setError(null);
                }}
                className="mt-1 h-4 w-4 accent-purple-500"
              />
              <div>
                <p className="text-sm font-medium text-white">Lyrics</p>
                <p className="mt-1 text-xs text-gray-500">Run Whisper transcription only when selected</p>
              </div>
            </div>
          </label>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Note: HTDemucs calculates its source separation together. Instrumental and Lyrics may require temporary
          internal stems, but those files are removed unless you selected them.
        </p>
      </div>

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
        className={`card flex cursor-pointer flex-col items-center gap-4 border-dashed py-12 transition ${
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
          Upload & Process Selected
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
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

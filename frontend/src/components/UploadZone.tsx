"use client";

import { useCallback, useRef, useState } from "react";
import type { OutputStem, SeparationOptions, TranscriptionLanguage } from "@/lib/types";

interface UploadZoneProps {
  onUpload: (file: File, options: SeparationOptions) => void;
  disabled?: boolean;
}

const ACCEPT = "audio/mpeg,audio/wav,audio/flac,audio/mp4,audio/ogg,audio/aac,.mp3,.wav,.flac,.m4a,.ogg,.aac";
const MAX_MB = 100;

const OUTPUTS: Array<{ name: OutputStem; label: string; help: string; accent: string }> = [
  { name: "vocals", label: "Vocals", help: "Isolated singing voice", accent: "from-pink-500 to-rose-400" },
  { name: "instrumental", label: "Instrumental", help: "Music without lead vocals", accent: "from-violet-500 to-purple-400" },
  { name: "drums", label: "Drums", help: "Drums and percussion", accent: "from-orange-500 to-amber-400" },
  { name: "bass", label: "Bass", help: "Bass-focused source stem", accent: "from-blue-500 to-cyan-400" },
  { name: "other", label: "Other", help: "Keys, guitars and remaining mix", accent: "from-teal-500 to-emerald-400" },
];

const DEFAULT_OUTPUTS: OutputStem[] = ["vocals", "instrumental"];

const LANGUAGES: Array<{ code: TranscriptionLanguage; label: string; native: string; help: string }> = [
  { code: "auto", label: "Auto detect", native: "Smart", help: "Best for mixed or unknown language" },
  { code: "en", label: "English", native: "English", help: "Skip detection for English songs" },
  { code: "hi", label: "Hindi", native: "हिन्दी", help: "Hindi and Hinglish-focused songs" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", help: "Gujarati-focused songs" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({ onUpload, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputStem[]>(DEFAULT_OUTPUTS);
  const [includeLyrics, setIncludeLyrics] = useState(true);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<TranscriptionLanguage>("auto");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const validate = useCallback(
    (file: File): string | null => {
      if (!file || file.size === 0) return "The selected audio file is empty";
      if (file.size > MAX_MB * 1024 * 1024) return `File exceeds the ${MAX_MB} MB limit`;
      const ext = file.name.split(".").pop()?.toLowerCase();
      const allowed = ["mp3", "wav", "flac", "m4a", "ogg", "aac"];
      if (!ext || !allowed.includes(ext)) return `Unsupported format. Use ${allowed.join(", ")}`;
      if (outputs.length === 0 && !includeLyrics) return "Select at least one stem or Lyrics";
      return null;
    },
    [includeLyrics, outputs.length],
  );

  const selectFile = useCallback(
    (file: File) => {
      const fileError = validate(file);
      if (fileError) {
        setPendingFile(null);
        setError(fileError);
        return;
      }
      setPendingFile(file);
      setError(null);
    },
    [validate],
  );

  const toggleOutput = (name: OutputStem) => {
    setOutputs((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
    setError(null);
  };

  const applyPreset = (preset: "karaoke" | "instrumental" | "full") => {
    if (preset === "karaoke") {
      setOutputs(["vocals", "instrumental"]);
      setIncludeLyrics(true);
    } else if (preset === "instrumental") {
      setOutputs(["instrumental"]);
      setIncludeLyrics(false);
    } else {
      setOutputs(OUTPUTS.map((item) => item.name));
      setIncludeLyrics(true);
    }
    setError(null);
  };

  const submit = () => {
    if (!pendingFile) {
      setError("Choose an audio file before starting");
      return;
    }
    const submitError = validate(pendingFile);
    if (submitError) {
      setError(submitError);
      return;
    }
    setError(null);
    onUpload(pendingFile, {
      outputs,
      include_lyrics: includeLyrics,
      transcription_language: includeLyrics ? transcriptionLanguage : "auto",
    });
  };

  const selectionCount = outputs.length + (includeLyrics ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <section className="rounded-[2rem] border border-white/[0.08] bg-[#0d111d]/[0.85] p-5 shadow-2xl backdrop-blur sm:p-7">
        <div className="flex flex-col gap-5 border-b border-white/5 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Step 1 · Choose outputs</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">What do you want from this song?</h2>
            <p className="mt-2 text-sm text-slate-500">Only selected results are kept for your session and downloads.</p>
          </div>
          <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-slate-400">
            {selectionCount} selected
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={disabled} onClick={() => applyPreset("karaoke")} className="preset-chip">Karaoke setup</button>
          <button type="button" disabled={disabled} onClick={() => applyPreset("instrumental")} className="preset-chip">Instrumental only</button>
          <button type="button" disabled={disabled} onClick={() => applyPreset("full")} className="preset-chip">Full stem pack</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OUTPUTS.map((item) => {
            const checked = outputs.includes(item.name);
            return (
              <label
                key={item.name}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all ${
                  checked
                    ? "border-violet-400/30 bg-violet-500/[0.075] shadow-[0_0_0_1px_rgba(139,92,246,.04)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.035]"
                } ${disabled ? "pointer-events-none opacity-50" : ""}`}
              >
                <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${item.accent} ${checked ? "opacity-80" : "opacity-0 group-hover:opacity-30"}`} />
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} bg-opacity-10 text-white shadow-lg`}>
                    <span className="h-2 w-2 rounded-full bg-white/90" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                      {checked && <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300">Selected</span>}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.help}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleOutput(item.name)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-violet-500"
                  />
                </div>
              </label>
            );
          })}

          <label
            className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all ${
              includeLyrics
                ? "border-cyan-300/25 bg-cyan-300/[0.055]"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.035]"
            } ${disabled ? "pointer-events-none opacity-50" : ""}`}
          >
            <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400 to-blue-400 ${includeLyrics ? "opacity-80" : "opacity-0 group-hover:opacity-30"}`} />
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 5h10M7 9h10M7 13h6M5 3h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-100">Lyrics</p>
                  {includeLyrics && <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">Selected</span>}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">Timestamped transcription for karaoke practice</p>
              </div>
              <input
                type="checkbox"
                checked={includeLyrics}
                disabled={disabled}
                onChange={(event) => {
                  setIncludeLyrics(event.target.checked);
                  setError(null);
                }}
                className="mt-1 h-4 w-4 accent-cyan-400"
              />
            </div>
          </label>
        </div>

        <div className={`mt-5 rounded-2xl border p-4 transition ${includeLyrics ? "border-cyan-300/10 bg-cyan-300/[0.025]" : "border-white/5 bg-black/10 opacity-55"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Lyric language</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Choose a language when you know it. Auto detect still works for mixed or unknown songs.</p>
            </div>
            {includeLyrics && transcriptionLanguage !== "auto" && (
              <span className="w-fit rounded-full border border-emerald-300/10 bg-emerald-300/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                Faster hint
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {LANGUAGES.map((language) => {
              const active = transcriptionLanguage === language.code;
              return (
                <button
                  key={language.code}
                  type="button"
                  disabled={disabled || !includeLyrics}
                  onClick={() => setTranscriptionLanguage(language.code)}
                  className={`min-w-0 rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-violet-400/25 bg-violet-500/[0.09] text-white"
                      : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.04]"
                  } disabled:pointer-events-none`}
                >
                  <span className="block truncate text-sm font-semibold">{language.native}</span>
                  <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-slate-600">{language.label}</span>
                  <span className="mt-2 block text-[11px] leading-4 text-slate-600">{language.help}</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-600">
          HTDemucs calculates its four core sources together. Some temporary internal stems may be created to build an instrumental or lyrics, then removed when they were not selected.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/[0.08] bg-[#0d111d]/[0.85] p-5 shadow-2xl backdrop-blur sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Step 2 · Add audio</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Choose your track</h2>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Choose audio file"
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !disabled) inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (disabled) return;
            const file = event.dataTransfer.files[0];
            if (file) selectFile(file);
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[1.6rem] border border-dashed px-5 py-10 text-center transition-all sm:py-12 ${
            dragging
              ? "border-violet-300/60 bg-violet-500/10 shadow-[inset_0_0_60px_rgba(124,92,255,.06)]"
              : "border-white/[0.12] bg-black/10 hover:border-violet-300/30 hover:bg-violet-500/[0.035]"
          } ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.15] to-cyan-400/10 text-violet-200 shadow-xl">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
            </svg>
          </div>
          <p className="mt-5 text-base font-semibold text-white sm:text-lg">Drop a song here, or click to browse</p>
          <p className="mt-2 text-sm text-slate-500">MP3, WAV, FLAC, M4A, OGG, AAC · up to {MAX_MB} MB</p>
          <span className="btn-secondary mt-5 pointer-events-none">Browse audio</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) selectFile(file);
              event.target.value = "";
            }}
          />
        </div>

        {pendingFile && (
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.035] p-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200" title={pendingFile.name}>{pendingFile.name}</p>
              <p className="mt-1 text-xs text-slate-500">{formatFileSize(pendingFile.size)} · Ready to process</p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setPendingFile(null);
                setError(null);
              }}
              className="text-xs font-medium text-slate-500 transition hover:text-slate-200"
            >
              Remove
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-400/[0.15] bg-red-400/[0.055] px-4 py-3 text-sm text-red-300" role="alert">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-600">Your job runs on the backend. Keep the studio tab open while the AI pipeline is processing.</p>
          <button type="button" disabled={disabled || !pendingFile || selectionCount === 0} onClick={submit} className="btn-primary btn-large shrink-0">
            Create my session
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </section>
    </div>
  );
}

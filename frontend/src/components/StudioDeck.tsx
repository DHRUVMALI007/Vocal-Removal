"use client";

import type { CSSProperties } from "react";
import WaveformPlayer from "./WaveformPlayer";
import type { PlaybackSpeed } from "@/lib/types";

interface StudioDeckProps {
  trackName: string;
  practiceLabel: string;
  loaded: boolean;
  loadError: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: PlaybackSpeed;
  loopRange: { start: number; end: number } | null;
  waveformUrl: string;
  onTogglePlay: () => void;
  onJump: (seconds: number) => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onLoopFromNow: (seconds: number) => void;
  onClearLoop: () => void;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function TransportIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" />
    </svg>
  ) : (
    <svg className="ml-0.5 h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

export default function StudioDeck({
  trackName,
  practiceLabel,
  loaded,
  loadError,
  isPlaying,
  currentTime,
  duration,
  playbackSpeed,
  loopRange,
  waveformUrl,
  onTogglePlay,
  onJump,
  onSeek,
  onSpeedChange,
  onLoopFromNow,
  onClearLoop,
}: StudioDeckProps) {
  const safeDuration = Math.max(0, duration);
  const safeTime = Math.max(0, Math.min(currentTime, safeDuration || currentTime));
  const progress = safeDuration > 0 ? Math.min(100, (safeTime / safeDuration) * 100) : 0;
  const scrubberStyle = { "--deck-progress": `${progress}%` } as CSSProperties;

  return (
    <section className="studio-deck relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#080c15]/95 p-4 shadow-2xl sm:rounded-[2rem] sm:p-6 xl:p-8 2xl:p-10">
      <div className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-violet-500/[0.08] blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/[0.055] blur-3xl" aria-hidden="true" />

      <header className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.16] bg-emerald-300/[0.055] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
              <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? "animate-pulse bg-emerald-300" : "bg-emerald-300/70"}`} />
              Performance deck
            </span>
            <span className="rounded-full border border-violet-400/10 bg-violet-500/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100/80">
              {practiceLabel}
            </span>
          </div>
          <h1 className="mt-4 max-w-5xl truncate text-2xl font-black tracking-[-0.035em] text-white sm:text-4xl xl:text-5xl" title={trackName}>
            {trackName}
          </h1>
          <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">
            Click or drag the position bar, or click anywhere on the waveform, to jump directly to that part of the song.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <span className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 font-mono text-xs tabular-nums text-slate-400">
            {formatTime(safeTime)} / {formatTime(safeDuration)}
          </span>
          <span className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] ${loaded ? "border-emerald-300/10 bg-emerald-300/[0.035] text-emerald-200" : "border-white/[0.06] bg-white/[0.025] text-slate-600"}`}>
            {isPlaying ? "Playing" : loaded ? "Deck ready" : "Loading"}
          </span>
        </div>
      </header>

      <div className="relative mt-7 grid gap-5 xl:grid-cols-[minmax(190px,.55fr)_minmax(360px,1.35fr)_minmax(250px,.72fr)] xl:items-center">
        <div className="order-2 rounded-2xl border border-white/[0.06] bg-black/15 p-4 xl:order-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Deck time</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tabular-nums text-white xl:text-4xl">{formatTime(safeTime)}</span>
            <span className="font-mono text-xs tabular-nums text-slate-600">/ {formatTime(safeDuration)}</span>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-600">Arrow keys seek 10 seconds. Space toggles play and pause.</p>
        </div>

        <div className="order-1 flex items-center justify-center gap-3 sm:gap-4 xl:order-2">
          <button type="button" onClick={() => onJump(-10)} disabled={!loaded} className="transport-secondary transport-secondary-large" aria-label="Go back 10 seconds">
            <span className="text-sm">-10</span>
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!loaded}
            className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 text-white shadow-[0_18px_48px_rgba(124,92,255,.32)] transition hover:scale-[1.035] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:h-20 sm:w-20 xl:h-24 xl:w-24 xl:rounded-[1.75rem]"
            aria-label={isPlaying ? "Pause session" : "Play session"}
          >
            <TransportIcon playing={isPlaying} />
          </button>
          <button type="button" onClick={() => onJump(10)} disabled={!loaded} className="transport-secondary transport-secondary-large" aria-label="Go forward 10 seconds">
            <span className="text-sm">+10</span>
          </button>
        </div>

        <div className="order-3 rounded-2xl border border-white/[0.06] bg-black/15 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Playback speed</p>
          <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl border border-white/[0.05] bg-black/15 p-1" role="group" aria-label="Playback speed">
            {([0.5, 0.75, 1, 1.25] as PlaybackSpeed[]).map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onSpeedChange(speed)}
                className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition ${playbackSpeed === speed ? "bg-white/[0.1] text-white shadow-sm" : "text-slate-600 hover:text-slate-300"}`}
              >
                {speed}x
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <button type="button" onClick={() => onLoopFromNow(4)} className="practice-control">4s loop</button>
            <button type="button" onClick={() => onLoopFromNow(8)} className="practice-control">8s loop</button>
            <button type="button" onClick={() => onLoopFromNow(16)} className="practice-control">16s loop</button>
          </div>
          {loopRange && (
            <button type="button" onClick={onClearLoop} className="mt-2 w-full rounded-lg px-2 py-1.5 text-[10px] font-semibold text-red-300 transition hover:bg-red-400/[0.05]">
              Clear {formatTime(loopRange.start)}-{formatTime(loopRange.end)} loop
            </button>
          )}
        </div>
      </div>

      <div className="relative mt-6 rounded-2xl border border-white/[0.065] bg-black/20 p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Track position</p>
          <p className="text-[10px] text-slate-700">Click or drag to seek</p>
        </div>
        <input
          type="range"
          min={0}
          max={safeDuration || 0}
          step={0.01}
          value={safeDuration > 0 ? safeTime : 0}
          disabled={!loaded || safeDuration <= 0}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          className="deck-scrubber w-full"
          style={scrubberStyle}
          aria-label="Song position"
          aria-valuetext={`${formatTime(safeTime)} of ${formatTime(safeDuration)}`}
        />
      </div>

      {waveformUrl && (
        <div className="relative mt-5">
          <WaveformPlayer
            url={waveformUrl}
            currentTime={safeTime}
            duration={safeDuration}
            isPlaying={isPlaying}
            onSeek={onSeek}
            loopRange={loopRange}
            embedded
            height={170}
            seekEnabled={loaded}
          />
        </div>
      )}

      <footer className="relative mt-5 flex flex-col gap-2 border-t border-white/5 pt-4 text-[10px] text-slate-700 md:flex-row md:items-center md:justify-between">
        <span>Keyboard: Space play/pause · Left/Right 10 sec · K vocal practice · L 8 sec loop</span>
        <span>{loopRange ? `Loop active ${formatTime(loopRange.start)}-${formatTime(loopRange.end)}` : `Speed ${playbackSpeed}x`}</span>
      </footer>

      {loadError && <p className="relative mt-4 rounded-xl border border-red-400/[0.15] bg-red-400/[0.05] px-3 py-2 text-xs text-red-300">{loadError}</p>}
    </section>
  );
}

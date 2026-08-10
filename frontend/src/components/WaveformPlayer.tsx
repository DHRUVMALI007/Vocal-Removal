"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

interface WaveformPlayerProps {
  url: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  loopRange?: { start: number; end: number } | null;
  embedded?: boolean;
  height?: number;
  seekEnabled?: boolean;
}

function formatTime(time: number) {
  if (!Number.isFinite(time) || time < 0) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function WaveformPlayer({
  url,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  loopRange,
  embedded = false,
  height = 116,
  seekEnabled = true,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);
    setError(null);

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#30384d",
      progressColor: "#8b7cff",
      cursorColor: "#86e5ff",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height,
      normalize: true,
      // Seeking is handled by our wrapper. This avoids WaveSurfer's internal
      // seek and the synchronized mixer fighting each other on the same click.
      interact: false,
    });

    waveSurfer.load(url);
    waveSurfer.on("ready", () => setReady(true));
    waveSurfer.on("error", () => setError("The waveform preview could not be loaded."));
    wsRef.current = waveSurfer;

    return () => {
      waveSurfer.destroy();
      wsRef.current = null;
    };
  }, [height, url]);

  useEffect(() => {
    const waveSurfer = wsRef.current;
    if (!waveSurfer || !ready || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, currentTime / duration));
    waveSurfer.seekTo(ratio);
  }, [currentTime, duration, ready]);

  const seekFromPointer = (clientX: number, element: HTMLDivElement) => {
    if (!ready || !seekEnabled || duration <= 0) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const content = (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isPlaying ? "animate-pulse bg-emerald-300" : "bg-slate-600"}`} />
          <span className="text-xs font-medium text-slate-400">{isPlaying ? "Deck waveform · live" : "Deck waveform"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-700">Click waveform to seek</span>
          <span className="font-mono text-xs tabular-nums text-slate-500">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      </div>

      <div
        role="slider"
        tabIndex={ready && seekEnabled ? 0 : -1}
        aria-label="Waveform song position"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, duration)}
        aria-valuenow={Math.max(0, Math.min(currentTime, duration || currentTime))}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        onPointerDown={(event) => seekFromPointer(event.clientX, event.currentTarget)}
        onKeyDown={(event) => {
          if (!ready || !seekEnabled || duration <= 0) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onSeek(Math.max(0, currentTime - 5));
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            onSeek(Math.min(duration, currentTime + 5));
          } else if (event.key === "Home") {
            event.preventDefault();
            onSeek(0);
          } else if (event.key === "End") {
            event.preventDefault();
            onSeek(duration);
          }
        }}
        className={`deck-waveform-seek relative overflow-hidden rounded-2xl border border-white/5 bg-black/[0.17] px-2 py-3 outline-none transition ${ready && seekEnabled ? "cursor-crosshair focus:border-violet-400/30 focus:ring-2 focus:ring-violet-500/10" : "cursor-wait"}`}
        title={ready && seekEnabled ? "Click anywhere to move playback to that point" : "Loading synchronized audio"}
      >
        {!ready && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090c14]/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              Drawing waveform...
            </div>
          </div>
        )}
        <div ref={containerRef} id="waveform" className="w-full" style={{ minHeight: height }} />
        {ready && duration > 0 && (
          <div
            className="pointer-events-none absolute bottom-2 top-2 w-px bg-cyan-200/60 shadow-[0_0_12px_rgba(103,232,249,.6)]"
            style={{ left: `${Math.max(0, Math.min(100, (currentTime / duration) * 100))}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      {loopRange && (
        <div className="mt-3 flex items-center gap-2 text-xs text-cyan-200/80">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></svg>
          Loop {formatTime(loopRange.start)} - {formatTime(loopRange.end)}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="deck-waveform-panel rounded-2xl border border-white/[0.055] bg-[#090d16]/80 p-3 sm:p-5">{content}</div>;
  }

  return (
    <section className="rounded-2xl border border-white/[0.09] bg-[#090d16]/95 p-3 shadow-2xl sm:rounded-[2rem] sm:p-5 xl:p-6">
      {content}
    </section>
  );
}

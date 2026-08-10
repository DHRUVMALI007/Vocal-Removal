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
      waveColor: "#323950",
      progressColor: "#8b7cff",
      cursorColor: "#86e5ff",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 88,
      normalize: true,
      interact: true,
    });

    waveSurfer.load(url);
    waveSurfer.on("ready", () => setReady(true));
    waveSurfer.on("error", () => setError("The waveform preview could not be loaded."));
    waveSurfer.on("click", () => onSeek(waveSurfer.getCurrentTime()));
    wsRef.current = waveSurfer;

    return () => {
      waveSurfer.destroy();
      wsRef.current = null;
    };
  }, [url]); // onSeek intentionally excluded: the mixer seek callback is stable.

  useEffect(() => {
    const waveSurfer = wsRef.current;
    if (!waveSurfer || !ready || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, currentTime / duration));
    waveSurfer.seekTo(ratio);
  }, [currentTime, duration, ready]);

  return (
    <section className="rounded-[2rem] border border-white/[0.08] bg-[#0d111d]/[0.85] p-4 shadow-xl sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isPlaying ? "animate-pulse bg-emerald-300" : "bg-slate-600"}`} />
          <span className="text-xs font-medium text-slate-400">{isPlaying ? "Live playback" : "Session timeline"}</span>
        </div>
        <div className="font-mono text-xs tabular-nums text-slate-500">{formatTime(currentTime)} / {formatTime(duration)}</div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-black/[0.15] px-2 py-3">
        {!ready && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090c14]/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              Drawing waveform…
            </div>
          </div>
        )}
        <div ref={containerRef} id="waveform" className="min-h-[88px] w-full" />
      </div>

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      {loopRange && (
        <div className="mt-3 flex items-center gap-2 text-xs text-cyan-200/80">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></svg>
          Loop {formatTime(loopRange.start)} – {formatTime(loopRange.end)}
        </div>
      )}
    </section>
  );
}

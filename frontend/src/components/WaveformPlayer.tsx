"use client";

import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

interface WaveformPlayerProps {
  url: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  loopRange?: { start: number; end: number } | null;
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

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#3b3b55",
      progressColor: "#8b5cf6",
      cursorColor: "#a78bfa",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      normalize: true,
      interact: true,
    });

    ws.load(url);
    ws.on("click", () => onSeek(ws.getCurrentTime()));
    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || duration <= 0) return;
    ws.seekTo(currentTime / duration);
  }, [currentTime, duration]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span className={isPlaying ? "text-accent-light" : ""}>{isPlaying ? "Playing" : "Paused"}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div ref={containerRef} id="waveform" className="w-full" />
      {loopRange && (
        <p className="mt-2 text-xs text-accent-light">
          Loop: {formatTime(loopRange.start)} – {formatTime(loopRange.end)}
        </p>
      )}
    </div>
  );
}

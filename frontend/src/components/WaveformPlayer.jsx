import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { formatTime } from "../utils/formatTime";

export default function WaveformPlayer({ url, currentTime, duration, isPlaying, onSeek, loopRange }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const seekingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !url) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#3b3b55",
      progressColor: "#8b5cf6",
      cursorColor: "#a78bfa",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 72,
      normalize: true,
      interact: true,
    });

    ws.load(url);
    ws.on("interaction", () => {
      seekingRef.current = true;
      onSeek(ws.getCurrentTime());
      setTimeout(() => { seekingRef.current = false; }, 50);
    });

    wsRef.current = ws;
    return () => { ws.destroy(); wsRef.current = null; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !duration || seekingRef.current) return;
    ws.seekTo(currentTime / duration);
  }, [currentTime, duration]);

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span className={isPlaying ? "text-accent-light" : ""}>{isPlaying ? "Playing" : "Paused"}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div ref={containerRef} className="w-full min-h-[72px]" aria-label="Audio waveform" />
      {loopRange && (
        <p className="mt-2 text-xs text-accent-light">
          Loop: {formatTime(loopRange.start)} – {formatTime(loopRange.end)}
        </p>
      )}
    </div>
  );
}

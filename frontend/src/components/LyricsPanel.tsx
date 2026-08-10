"use client";

import { useEffect, useRef } from "react";
import type { LyricLine, PlaybackSpeed } from "@/lib/types";
import { PLAYBACK_SPEEDS } from "@/lib/types";

interface LyricsPanelProps {
  lines: LyricLine[];
  currentTime: number;
  karaokeMode: boolean;
  vocalsMuted: boolean;
  playbackSpeed: PlaybackSpeed;
  loopRange: { start: number; end: number } | null;
  hasAudio: boolean;
  hasVocals: boolean;
  hasInstrumental: boolean;
  onSeek: (time: number) => void;
  onSetLoop: (range: { start: number; end: number } | null) => void;
  onToggleKaraoke: () => void;
  onToggleVocals: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

export default function LyricsPanel({
  lines,
  currentTime,
  karaokeMode,
  vocalsMuted,
  playbackSpeed,
  loopRange,
  hasAudio,
  hasVocals,
  hasInstrumental,
  onSeek,
  onSetLoop,
  onToggleKaraoke,
  onToggleVocals,
  onSpeedChange,
}: LyricsPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const loopStartRef = useRef<number | null>(null);

  const activeIndex = hasAudio
    ? lines.findIndex((l) => currentTime >= l.start && currentTime < l.end)
    : -1;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  const handleLineClick = (line: LyricLine) => {
    if (!hasAudio) return;
    if (loopStartRef.current === null) {
      loopStartRef.current = line.start;
    } else {
      const start = loopStartRef.current;
      const end = line.end;
      onSetLoop(start < end ? { start, end } : { start: end, end: start });
      loopStartRef.current = null;
    }
    onSeek(line.start);
  };

  return (
    <div className="card flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold uppercase tracking-wider text-gray-400">Lyrics</h3>

        {hasVocals && hasInstrumental && (
          <button
            type="button"
            onClick={onToggleKaraoke}
            className={`btn-secondary text-xs ${karaokeMode ? "border-accent text-accent-light" : ""}`}
          >
            {karaokeMode ? "Karaoke ON" : "Karaoke OFF"}
          </button>
        )}

        {hasVocals && (
          <button
            type="button"
            onClick={onToggleVocals}
            className={`btn-secondary text-xs ${!vocalsMuted ? "border-pink-500/50 text-pink-400" : ""}`}
            title="Toggle reference vocals"
          >
            {vocalsMuted ? "Vocals Off" : "Vocals On"}
          </button>
        )}

        {hasAudio && (
          <div className="flex gap-1">
            {PLAYBACK_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSpeedChange(s)}
                className={`rounded px-2 py-1 text-xs ${playbackSpeed === s ? "bg-accent text-white" : "bg-surface-border text-gray-400"}`}
              >
                {s}x
              </button>
            ))}
          </div>
        )}

        {hasAudio && loopRange && (
          <button type="button" onClick={() => onSetLoop(null)} className="btn-secondary text-xs text-red-400">
            Clear Loop
          </button>
        )}
      </div>

      <p className="mb-2 text-xs text-gray-500">
        {hasAudio
          ? "Click a line to seek. Click two lines to set a loop range."
          : "Lyrics-only result. Select an audio output next time to enable synchronized playback."}
      </p>

      <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: "400px" }}>
        {lines.length === 0 ? (
          <p className="text-sm text-gray-500">No lyrics detected.</p>
        ) : (
          lines.map((line, i) => {
            const isActive = i === activeIndex;
            return (
              <div
                key={`${line.start}-${i}`}
                ref={isActive ? activeRef : undefined}
                role={hasAudio ? "button" : undefined}
                tabIndex={hasAudio ? 0 : undefined}
                onClick={() => handleLineClick(line)}
                onKeyDown={(e) => e.key === "Enter" && handleLineClick(line)}
                className={`rounded-lg px-3 py-2 text-base transition ${
                  hasAudio ? "cursor-pointer" : ""
                } ${
                  isActive
                    ? "bg-gradient-to-r from-accent/30 to-blue-500/20 font-semibold text-white"
                    : "text-gray-400 hover:bg-surface-elevated hover:text-gray-200"
                }`}
              >
                <span className="mr-2 text-xs text-gray-600">{formatTime(line.start)}</span>
                {line.text}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

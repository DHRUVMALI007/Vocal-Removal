"use client";

import { useEffect, useRef, useState } from "react";
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

function formatTime(time: number) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
  const activeRef = useRef<HTMLButtonElement>(null);
  const [loopMode, setLoopMode] = useState(false);
  const [pendingLoopStart, setPendingLoopStart] = useState<number | null>(null);

  const activeIndex = hasAudio
    ? lines.findIndex((line) => currentTime >= line.start && currentTime < line.end)
    : -1;
  const activeLine = activeIndex >= 0 ? lines[activeIndex] : null;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  const handleLineClick = (line: LyricLine) => {
    if (!hasAudio) return;
    onSeek(line.start);

    if (!loopMode) return;
    if (pendingLoopStart === null) {
      setPendingLoopStart(line.start);
      return;
    }

    const start = Math.min(pendingLoopStart, line.start);
    const end = Math.max(pendingLoopStart, line.end);
    onSetLoop({ start, end });
    setPendingLoopStart(null);
    setLoopMode(false);
  };

  const clearLoop = () => {
    setPendingLoopStart(null);
    setLoopMode(false);
    onSetLoop(null);
  };

  return (
    <section className="rounded-[2rem] border border-white/[0.08] bg-[#0d111d]/[0.85] p-5 shadow-xl sm:p-6">
      <div className="flex flex-col gap-4 border-b border-white/5 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Lyrics practice</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Follow the vocal timeline</h2>
          </div>
          {hasVocals && hasInstrumental && (
            <button
              type="button"
              onClick={onToggleKaraoke}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                karaokeMode
                  ? "border-violet-400/25 bg-violet-500/10 text-violet-200"
                  : "border-white/[0.08] bg-white/[0.025] text-slate-400 hover:text-white"
              }`}
            >
              {karaokeMode ? "Karaoke on" : "Karaoke off"}
            </button>
          )}
        </div>

        {hasAudio && (
          <div className="flex flex-wrap items-center gap-2">
            {hasVocals && (
              <button
                type="button"
                onClick={onToggleVocals}
                className={`practice-control ${!vocalsMuted ? "border-pink-400/25 bg-pink-400/10 text-pink-200" : ""}`}
                title="Toggle the reference vocal stem"
              >
                {vocalsMuted ? "Reference vocal off" : "Reference vocal on"}
              </button>
            )}

            <div className="flex items-center rounded-xl border border-white/[0.06] bg-black/10 p-1" role="group" aria-label="Playback speed">
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => onSpeedChange(speed)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    playbackSpeed === speed ? "bg-white/[0.09] text-white" : "text-slate-500 hover:text-slate-200"
                  }`}
                >
                  {speed}×
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setLoopMode((current) => !current);
                setPendingLoopStart(null);
              }}
              className={`practice-control ${loopMode ? "border-cyan-300/25 bg-cyan-300/[0.07] text-cyan-200" : ""}`}
            >
              {loopMode ? (pendingLoopStart === null ? "Pick loop start" : "Pick loop end") : "Loop section"}
            </button>

            {(loopRange || pendingLoopStart !== null) && (
              <button type="button" onClick={clearLoop} className="practice-control text-red-300">Clear loop</button>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.075] to-cyan-400/[0.035] px-5 py-5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          {activeLine ? `Now · ${formatTime(activeLine.start)}` : hasAudio ? "Ready for playback" : "Transcription"}
        </p>
        <p className={`mt-2 min-h-12 text-lg font-semibold leading-7 ${activeLine ? "text-white" : "text-slate-500"}`}>
          {activeLine?.text || (hasAudio ? "Press play and the current lyric will appear here." : "Lyrics are available below without synchronized audio playback.")}
        </p>
      </div>

      {loopRange && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-2 text-xs text-cyan-100/80">
          <span>Looping {formatTime(loopRange.start)} → {formatTime(loopRange.end)}</span>
          <button type="button" onClick={clearLoop} className="font-medium text-cyan-200 hover:text-white">Clear</button>
        </div>
      )}

      <div className="lyrics-scroll mt-4 max-h-[410px] space-y-1 overflow-y-auto pr-1">
        {lines.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-black/10 px-4 py-8 text-center text-sm text-slate-500">No lyrics were detected for this track.</div>
        ) : (
          lines.map((line, index) => {
            const active = index === activeIndex;
            const loopStart = pendingLoopStart === line.start;
            return (
              <button
                key={`${line.start}-${index}`}
                ref={active ? activeRef : undefined}
                type="button"
                disabled={!hasAudio}
                onClick={() => handleLineClick(line)}
                className={`group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  active
                    ? "bg-white/[0.07] text-white"
                    : loopStart
                      ? "bg-cyan-300/[0.06] text-cyan-100"
                      : "text-slate-500 hover:bg-white/[0.035] hover:text-slate-300"
                } ${hasAudio ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`mt-0.5 w-10 shrink-0 font-mono text-[10px] tabular-nums ${active ? "text-violet-300" : "text-slate-700"}`}>{formatTime(line.start)}</span>
                <span className="text-sm leading-6">{line.text}</span>
              </button>
            );
          })
        )}
      </div>

      <p className="mt-4 border-t border-white/5 pt-4 text-xs leading-5 text-slate-600">
        {hasAudio
          ? loopMode
            ? "Loop mode is armed: choose the start lyric, then the ending lyric."
            : "Click any lyric to seek directly to that line."
          : "Choose an audio stem on your next session to enable seek, loop, karaoke, and speed controls."}
      </p>
    </section>
  );
}

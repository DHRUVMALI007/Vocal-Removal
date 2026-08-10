"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  languageLabel?: string;
  languageConfidence?: number | null;
  practiceLabel?: string;
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
  languageLabel,
  languageConfidence,
  practiceLabel,
  onSeek,
  onSetLoop,
  onToggleKaraoke,
  onToggleVocals,
  onSpeedChange,
}: LyricsPanelProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const [loopMode, setLoopMode] = useState(false);
  const [pendingLoopStart, setPendingLoopStart] = useState<number | null>(null);
  const [followPlayback, setFollowPlayback] = useState(true);
  const [largeLyrics, setLargeLyrics] = useState(true);
  const displayedLines = lines;
  const activeIndex = hasAudio
    ? displayedLines.findIndex((line) => currentTime >= line.start && currentTime < line.end)
    : -1;
  const activeLine = activeIndex >= 0 ? displayedLines[activeIndex] : null;
  const nextLine = activeIndex >= 0 ? displayedLines[activeIndex + 1] : null;
  const confidence =
    typeof languageConfidence === "number" && languageConfidence >= 0 && languageConfidence <= 1
      ? Math.round(languageConfidence * 100)
      : null;

  const activeLineProgress = useMemo(() => {
    if (!activeLine) return 0;
    const span = Math.max(0.1, activeLine.end - activeLine.start);
    return Math.max(0, Math.min(1, (currentTime - activeLine.start) / span));
  }, [activeLine, currentTime]);

  useEffect(() => {
    if (!followPlayback) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex, followPlayback]);

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
    <section className="spotify-lyrics-panel overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0a0f18]/95 shadow-2xl sm:rounded-[2rem]">
      <div className="border-b border-white/[0.06] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-cyan-200">Live lyrics</p>
              <span className="rounded-full border border-emerald-300/10 bg-emerald-300/[0.035] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-100/70">Literal ASR</span>
              {languageLabel && (
                <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.04] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan-100/75">
                  {languageLabel}{confidence !== null ? ` · ${confidence}%` : ""}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">Follow every line while you play</h2>
            {practiceLabel && <p className="mt-1 text-xs text-slate-600">Current mode · {practiceLabel}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFollowPlayback((value) => !value)}
              className={`practice-control ${followPlayback ? "border-cyan-300/20 bg-cyan-300/[0.055] text-cyan-100" : ""}`}
            >
              {followPlayback ? "Following" : "Follow off"}
            </button>
            <button
              type="button"
              onClick={() => setLargeLyrics((value) => !value)}
              className={`practice-control ${largeLyrics ? "border-violet-400/20 bg-violet-500/[0.06] text-violet-100" : ""}`}
            >
              Lyrics {largeLyrics ? "XL" : "S"}
            </button>
          </div>
        </div>


        {hasAudio && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
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

            {hasVocals && hasInstrumental && (
              <button
                type="button"
                onClick={onToggleKaraoke}
                className={`practice-control ${karaokeMode ? "border-violet-400/25 bg-violet-500/10 text-violet-200" : ""}`}
              >
                {karaokeMode ? "Karaoke on" : "Karaoke off"}
              </button>
            )}

            <div className="flex max-w-full flex-wrap items-center rounded-xl border border-white/[0.06] bg-black/10 p-1" role="group" aria-label="Playback speed">
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => onSpeedChange(speed)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${playbackSpeed === speed ? "bg-white/[0.09] text-white" : "text-slate-500 hover:text-slate-200"}`}
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
              {loopMode ? (pendingLoopStart === null ? "Pick loop start" : "Pick loop end") : "Loop by lyrics"}
            </button>

            {(loopRange || pendingLoopStart !== null) && <button type="button" onClick={clearLoop} className="practice-control text-red-300">Clear loop</button>}
          </div>
        )}
      </div>

      <div className="relative overflow-hidden border-b border-white/[0.05] bg-gradient-to-br from-violet-500/[0.09] via-[#0d1320] to-cyan-400/[0.035] px-5 py-6 sm:px-6 sm:py-7">
        <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-cyan-300/[0.06] blur-3xl" aria-hidden="true" />
        <p className="relative text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">
          {activeLine ? `Now playing · ${formatTime(activeLine.start)}` : hasAudio ? "Press play" : "Transcript"}
        </p>
        <p className={`relative mt-3 min-h-20 font-bold leading-[1.24] tracking-[-0.02em] ${largeLyrics ? "text-2xl sm:text-[1.75rem] xl:text-3xl" : "text-lg sm:text-xl"} ${activeLine ? "text-white" : "text-slate-500"}`}>
          {activeLine?.text || (hasAudio ? "The current lyric will appear here and the list will follow automatically." : "Lyrics are available below without synchronized audio playback.")}
        </p>
        {activeLine && (
          <div className="relative mt-5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${activeLineProgress * 100}%` }} />
          </div>
        )}
        {nextLine && (
          <p className="relative mt-4 line-clamp-2 text-sm font-medium leading-6 text-slate-600">
            <span className="mr-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-700">Next</span>{nextLine.text}
          </p>
        )}
      </div>

      {loopRange && (
        <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-2 text-xs text-cyan-100/80 sm:mx-5">
          <span>Looping {formatTime(loopRange.start)} → {formatTime(loopRange.end)}</span>
          <button type="button" onClick={clearLoop} className="font-medium text-cyan-200 hover:text-white">Clear</button>
        </div>
      )}

      <div className="lyrics-scroll spotify-lyrics-scroll max-h-[470px] space-y-0.5 overflow-y-auto px-2 py-4 sm:max-h-[560px] sm:px-3 xl:max-h-[calc(100vh-27rem)] xl:min-h-[390px] 2xl:min-h-[500px]">
        {displayedLines.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-black/10 px-4 py-10 text-center text-sm text-slate-500">No lyrics were detected for this track.</div>
        ) : (
          displayedLines.map((line, index) => {
            const active = index === activeIndex;
            const loopStart = pendingLoopStart === line.start;
            const distance = activeIndex >= 0 ? Math.abs(index - activeIndex) : 99;
            return (
              <button
                key={`${line.start}-${index}`}
                ref={active ? activeRef : undefined}
                type="button"
                disabled={!hasAudio}
                onClick={() => handleLineClick(line)}
                className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition duration-300 sm:px-4 ${
                  active
                    ? "bg-white/[0.07] text-white"
                    : loopStart
                      ? "bg-cyan-300/[0.06] text-cyan-100"
                      : distance <= 2
                        ? "text-slate-400 hover:bg-white/[0.035] hover:text-slate-200"
                        : "text-slate-600 hover:bg-white/[0.025] hover:text-slate-400"
                } ${hasAudio ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`mt-1 w-9 shrink-0 font-mono text-[9px] tabular-nums ${active ? "text-violet-300" : "text-slate-700"}`}>{formatTime(line.start)}</span>
                <span className={`min-w-0 font-semibold leading-[1.45] tracking-[-0.01em] transition ${largeLyrics ? "text-base sm:text-lg xl:text-xl" : "text-sm sm:text-base"} ${active ? "translate-x-1" : ""}`}>{line.text}</span>
              </button>
            );
          })
        )}
      </div>

      <p className="border-t border-white/5 px-4 py-3 text-[10px] leading-5 text-slate-700 sm:px-5">
        {hasAudio
          ? loopMode
            ? "Loop mode is armed: choose the starting lyric, then the ending lyric."
            : "Click any lyric to seek. Follow mode keeps the active line centered while your instrument mix plays."
          : "Choose an audio stem on your next session to enable seek, loop, karaoke, speed, and instrument practice."}
      </p>
    </section>
  );
}

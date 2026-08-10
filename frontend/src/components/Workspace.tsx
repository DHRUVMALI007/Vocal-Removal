"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DownloadPanel from "./DownloadPanel";
import LyricsPanel from "./LyricsPanel";
import StemMixer from "./StemMixer";
import WaveformPlayer from "./WaveformPlayer";
import { getJobResults, getStemAudioUrl } from "@/lib/api";
import { useStemMixer } from "@/hooks/useStemMixer";
import type { JobResultsResponse, PlaybackSpeed, StemChannelState } from "@/lib/types";

interface WorkspaceProps {
  jobId: string;
  onNewSong?: () => void;
}

const DETAIL_STEMS = new Set(["drums", "bass", "other"]);
const LANGUAGE_LABELS: Record<string, string> = {
  auto: "Auto detect",
  en: "English",
  hi: "Hindi",
  gu: "Gujarati",
};

function buildChannels(results: JobResultsResponse, jobId: string): StemChannelState[] {
  const hasInstrumental = results.stems.some((stem) => stem.name === "instrumental");

  return results.stems
    .filter((stem) => stem.available !== false)
    .map((stem) => ({
      name: stem.name,
      label: stem.label,
      // Start ready for karaoke when a rendered instrumental exists. Keeping the
      // detail stems muted prevents accompaniment from being doubled.
      muted:
        (hasInstrumental && stem.name === "vocals") ||
        (hasInstrumental && DETAIL_STEMS.has(stem.name)),
      solo: false,
      volume: 1,
      url: getStemAudioUrl(jobId, stem.filename),
    }));
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5" aria-label="Loading studio results" role="status">
      <div className="h-32 animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] sm:h-36 sm:rounded-[2rem]" />
      <div className="h-40 animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] sm:h-44 sm:rounded-[2rem]" />
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] sm:h-80 sm:rounded-[2rem]" />
        <div className="h-72 animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] sm:h-80 sm:rounded-[2rem]" />
      </div>
    </div>
  );
}

function TransportIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
  ) : (
    <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z" /></svg>
  );
}

export default function Workspace({ jobId, onNewSong }: WorkspaceProps) {
  const [results, setResults] = useState<JobResultsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [channels, setChannels] = useState<StemChannelState[]>([]);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const currentTimeRef = useRef(0);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    setResults(null);

    getJobResults(jobId)
      .then((response) => {
        if (!active) return;
        setResults(response);
        setChannels(buildChannels(response, jobId));
        const responseHasVocals = response.stems.some((stem) => stem.name === "vocals");
        const responseHasInstrumental = response.stems.some((stem) => stem.name === "instrumental");
        setKaraokeMode(responseHasVocals && responseHasInstrumental);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load job results");
      });

    return () => {
      active = false;
    };
  }, [jobId]);

  const effectiveChannels = useMemo(() => {
    return channels.map((channel) => {
      if (karaokeMode && channel.name === "vocals") {
        return { ...channel, muted: true, volume: 0 };
      }
      return channel;
    });
  }, [channels, karaokeMode]);

  const mixer = useStemMixer({ channels: effectiveChannels, playbackRate: playbackSpeed });
  const hasAudio = channels.length > 0;
  const hasVocals = channels.some((channel) => channel.name === "vocals");
  const hasInstrumental = channels.some((channel) => channel.name === "instrumental");
  const duration = mixer.duration || results?.duration_seconds || 0;

  useEffect(() => {
    currentTimeRef.current = mixer.currentTime;
  }, [mixer.currentTime]);

  useEffect(() => {
    if (!loopRange || !mixer.isPlaying) return;
    if (mixer.currentTime >= loopRange.end) mixer.seek(loopRange.start);
  }, [loopRange, mixer.currentTime, mixer.isPlaying, mixer.seek]);

  const updateChannel = useCallback((name: string, patch: Partial<StemChannelState>) => {
    setChannels((previous) => previous.map((channel) => (channel.name === name ? { ...channel, ...patch } : channel)));
    if (name === "vocals" && "muted" in patch) setKaraokeMode(Boolean(patch.muted));
  }, []);

  const toggleVocals = useCallback(() => {
    if (!hasVocals) return;
    const vocals = channels.find((channel) => channel.name === "vocals");
    const nextMuted = !(vocals?.muted ?? false);
    setChannels((previous) =>
      previous.map((channel) =>
        channel.name === "vocals"
          ? { ...channel, muted: nextMuted, volume: nextMuted ? 0 : Math.max(channel.volume, 1) }
          : channel,
      ),
    );
    setKaraokeMode(nextMuted && hasInstrumental);
  }, [channels, hasInstrumental, hasVocals]);

  const toggleKaraoke = useCallback(() => {
    if (!hasVocals || !hasInstrumental) return;
    const nextKaraoke = !karaokeMode;
    setKaraokeMode(nextKaraoke);
    setChannels((previous) =>
      previous.map((channel) => {
        if (channel.name === "vocals") {
          return { ...channel, muted: nextKaraoke, volume: nextKaraoke ? 0 : 1 };
        }
        if (DETAIL_STEMS.has(channel.name)) {
          return { ...channel, muted: true, solo: false };
        }
        if (channel.name === "instrumental") {
          return { ...channel, muted: false, solo: false, volume: Math.max(channel.volume, 1) };
        }
        return channel;
      }),
    );
  }, [hasInstrumental, hasVocals, karaokeMode]);

  const jumpBy = useCallback((seconds: number) => {
    mixer.seek(Math.max(0, Math.min(duration, currentTimeRef.current + seconds)));
  }, [duration, mixer.seek]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (target?.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select" || tagName === "button") return;

      if (event.code === "Space" && hasAudio) {
        event.preventDefault();
        mixer.togglePlay();
      } else if (event.key === "ArrowLeft" && hasAudio) {
        event.preventDefault();
        jumpBy(-5);
      } else if (event.key === "ArrowRight" && hasAudio) {
        event.preventDefault();
        jumpBy(5);
      } else if (event.key.toLowerCase() === "k" && hasVocals && hasInstrumental) {
        event.preventDefault();
        toggleKaraoke();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasAudio, hasInstrumental, hasVocals, jumpBy, mixer.togglePlay, toggleKaraoke]);

  const copySessionLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setLinkCopied(false);
    }
  }, []);

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-400/20 bg-red-400/[0.055] p-6 text-center sm:rounded-[2rem] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Studio unavailable</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Could not load the results.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{loadError}</p>
        {onNewSong && <button type="button" onClick={onNewSong} className="btn-primary mt-6 w-full sm:w-auto">Start a new session</button>}
      </div>
    );
  }

  if (!results) return <ResultsSkeleton />;

  const hasLyrics = results.lyrics !== null;
  const waveformStem =
    results.stems.find((stem) => stem.name === "instrumental") ||
    results.stems.find((stem) => stem.name === "vocals") ||
    results.stems[0];
  const waveformUrl = waveformStem ? getStemAudioUrl(jobId, waveformStem.filename) : "";
  const vocalsMuted = channels.find((channel) => channel.name === "vocals")?.muted ?? true;
  const trackName = typeof results.metadata.original_filename === "string" ? results.metadata.original_filename : "Processed track";
  const requestedLanguage = typeof results.metadata.requested_language === "string" ? results.metadata.requested_language : "auto";
  const detectedLanguage = typeof results.metadata.detected_language === "string" ? results.metadata.detected_language : null;
  const languageProbability = typeof results.metadata.language_probability === "number" ? results.metadata.language_probability : null;
  const effectiveLanguage = detectedLanguage || (requestedLanguage !== "auto" ? requestedLanguage : null);
  const languageLabel = effectiveLanguage ? (LANGUAGE_LABELS[effectiveLanguage] || effectiveLanguage.toUpperCase()) : "Auto detect";

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.085] via-[#0e1320] to-cyan-400/[0.035] p-4 shadow-2xl sm:rounded-[2rem] sm:p-7">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.15] bg-emerald-300/[0.055] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Session ready
              </span>
              <span className="text-xs text-slate-600">{channels.length} audio {channels.length === 1 ? "output" : "outputs"}</span>
              {hasLyrics && (
                <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-cyan-100/80">
                  {languageLabel}
                </span>
              )}
            </div>
            <h1 className="mt-4 truncate text-xl font-bold tracking-tight text-white sm:text-3xl" title={trackName}>{trackName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 sm:gap-x-5">
              <span>{formatTime(duration)} duration</span>
              <span>{hasLyrics ? `${results.lyrics?.lines.length ?? 0} lyric lines` : "No lyrics requested"}</span>
              <span className="hidden sm:inline">Job {jobId.slice(0, 8)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={copySessionLink} className="btn-secondary min-w-0 px-3">
              {linkCopied ? "Copied" : "Copy link"}
            </button>
            <a href="#downloads" className="btn-secondary min-w-0 px-3">Downloads</a>
            {onNewSong && <button type="button" onClick={onNewSong} className="btn-secondary col-span-2 sm:col-span-1">New song</button>}
          </div>
        </div>
      </section>

      {hasAudio && (
        <section className="rounded-2xl border border-white/[0.08] bg-[#0d111d]/[0.85] p-4 shadow-xl sm:rounded-[2rem] sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => jumpBy(-10)}
              disabled={!mixer.loaded}
              className="transport-secondary hidden sm:inline-flex"
              aria-label="Go back 10 seconds"
            >
              -10
            </button>
            <button
              type="button"
              onClick={mixer.togglePlay}
              disabled={!mixer.loaded}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-[0_10px_30px_rgba(124,92,255,.25)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40 sm:h-14 sm:w-14"
              aria-label={mixer.isPlaying ? "Pause session" : "Play session"}
            >
              <TransportIcon playing={mixer.isPlaying} />
            </button>
            <button
              type="button"
              onClick={() => jumpBy(10)}
              disabled={!mixer.loaded}
              className="transport-secondary hidden sm:inline-flex"
              aria-label="Go forward 10 seconds"
            >
              +10
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{mixer.isPlaying ? "Playing your mix" : mixer.loaded ? "Ready to play" : "Loading audio stems"}</p>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-500 sm:text-xs">{formatTime(mixer.currentTime)} / {formatTime(duration)} · {playbackSpeed}×</p>
                </div>
                {karaokeMode && <span className="hidden rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200 sm:inline-flex">Karaoke mode</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 hidden items-center justify-between border-t border-white/5 pt-3 text-[10px] text-slate-700 lg:flex">
            <span>Keyboard: Space play/pause · ←/→ 5 sec · K karaoke</span>
            <span>{loopRange ? `Loop ${formatTime(loopRange.start)}–${formatTime(loopRange.end)}` : "No loop active"}</span>
          </div>
          {mixer.loadError && <p className="mt-4 rounded-xl border border-red-400/[0.15] bg-red-400/[0.05] px-3 py-2 text-xs text-red-300">{mixer.loadError}</p>}
        </section>
      )}

      {waveformUrl && (
        <WaveformPlayer
          url={waveformUrl}
          currentTime={mixer.currentTime}
          duration={duration}
          isPlaying={mixer.isPlaying}
          onSeek={mixer.seek}
          loopRange={loopRange}
        />
      )}

      {(hasAudio || hasLyrics) && (
        <div className={`grid items-start gap-4 sm:gap-5 ${hasAudio && hasLyrics ? "xl:grid-cols-[minmax(0,1.03fr)_minmax(360px,.97fr)]" : ""}`}>
          {hasAudio && <StemMixer channels={channels} onChange={updateChannel} />}
          {hasLyrics && results.lyrics && (
            <LyricsPanel
              lines={results.lyrics.lines || []}
              currentTime={mixer.currentTime}
              karaokeMode={karaokeMode}
              vocalsMuted={vocalsMuted}
              playbackSpeed={playbackSpeed}
              loopRange={loopRange}
              hasAudio={hasAudio}
              hasVocals={hasVocals}
              hasInstrumental={hasInstrumental}
              languageLabel={languageLabel}
              languageConfidence={languageProbability}
              onSeek={mixer.seek}
              onSetLoop={setLoopRange}
              onToggleKaraoke={toggleKaraoke}
              onToggleVocals={toggleVocals}
              onSpeedChange={setPlaybackSpeed}
            />
          )}
        </div>
      )}

      {!hasAudio && hasLyrics && (
        <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] px-4 py-3 text-center text-sm text-slate-400">
          This is a lyrics-only result. Select an audio output next time to enable synchronized playback.
        </div>
      )}

      <div id="downloads">
        <DownloadPanel jobId={jobId} results={results} />
      </div>

      {hasAudio && (
        <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0f1b]/95 p-2.5 shadow-2xl backdrop-blur-xl sm:hidden">
          <button type="button" onClick={() => jumpBy(-10)} disabled={!mixer.loaded} className="mobile-transport-button" aria-label="Go back 10 seconds">-10</button>
          <button
            type="button"
            onClick={mixer.togglePlay}
            disabled={!mixer.loaded}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white disabled:opacity-40"
            aria-label={mixer.isPlaying ? "Pause session" : "Play session"}
          >
            <TransportIcon playing={mixer.isPlaying} />
          </button>
          <button type="button" onClick={() => jumpBy(10)} disabled={!mixer.loaded} className="mobile-transport-button" aria-label="Go forward 10 seconds">+10</button>
          <div className="min-w-0 flex-1 text-right">
            <p className="font-mono text-[11px] tabular-nums text-slate-300">{formatTime(mixer.currentTime)}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-600">{karaokeMode ? "Karaoke" : `${playbackSpeed}× speed`}</p>
          </div>
        </div>
      )}
    </div>
  );
}

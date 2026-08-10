"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    <div className="space-y-5" aria-label="Loading studio results" role="status">
      <div className="h-36 animate-pulse rounded-[2rem] border border-white/5 bg-white/[0.025]" />
      <div className="h-44 animate-pulse rounded-[2rem] border border-white/5 bg-white/[0.025]" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-[2rem] border border-white/5 bg-white/[0.025]" />
        <div className="h-80 animate-pulse rounded-[2rem] border border-white/5 bg-white/[0.025]" />
      </div>
    </div>
  );
}

export default function Workspace({ jobId, onNewSong }: WorkspaceProps) {
  const [results, setResults] = useState<JobResultsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [channels, setChannels] = useState<StemChannelState[]>([]);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    setResults(null);

    getJobResults(jobId)
      .then((response) => {
        if (!active) return;
        setResults(response);
        setChannels(buildChannels(response, jobId));
        const hasVocals = response.stems.some((stem) => stem.name === "vocals");
        const hasInstrumental = response.stems.some((stem) => stem.name === "instrumental");
        setKaraokeMode(hasVocals && hasInstrumental);
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

  useEffect(() => {
    if (!loopRange || !mixer.isPlaying) return;
    if (mixer.currentTime >= loopRange.end) mixer.seek(loopRange.start);
  }, [loopRange, mixer.currentTime, mixer.isPlaying, mixer.seek]);

  const updateChannel = useCallback((name: string, patch: Partial<StemChannelState>) => {
    setChannels((previous) => previous.map((channel) => (channel.name === name ? { ...channel, ...patch } : channel)));
    if (name === "vocals" && "muted" in patch) setKaraokeMode(Boolean(patch.muted));
  }, []);

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-red-400/20 bg-red-400/[0.055] p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Studio unavailable</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Could not load the results.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{loadError}</p>
        {onNewSong && <button type="button" onClick={onNewSong} className="btn-primary mt-6">Start a new session</button>}
      </div>
    );
  }

  if (!results) return <ResultsSkeleton />;

  const hasAudio = channels.length > 0;
  const hasLyrics = results.lyrics !== null;
  const hasVocals = channels.some((channel) => channel.name === "vocals");
  const hasInstrumental = channels.some((channel) => channel.name === "instrumental");
  const waveformStem =
    results.stems.find((stem) => stem.name === "instrumental") ||
    results.stems.find((stem) => stem.name === "vocals") ||
    results.stems[0];
  const waveformUrl = waveformStem ? getStemAudioUrl(jobId, waveformStem.filename) : "";
  const vocalsMuted = channels.find((channel) => channel.name === "vocals")?.muted ?? true;
  const duration = mixer.duration || results.duration_seconds || 0;
  const trackName = typeof results.metadata.original_filename === "string" ? results.metadata.original_filename : "Processed track";

  const toggleVocals = () => {
    if (!hasVocals) return;
    setChannels((previous) =>
      previous.map((channel) =>
        channel.name === "vocals"
          ? { ...channel, muted: !channel.muted, volume: channel.muted ? 1 : 0 }
          : channel,
      ),
    );
    setKaraokeMode((current) => !current);
  };

  const toggleKaraoke = () => {
    if (!hasVocals || !hasInstrumental) return;
    const nextKaraoke = !karaokeMode;
    setKaraokeMode(nextKaraoke);
    setChannels((previous) =>
      previous.map((channel) =>
        channel.name === "vocals"
          ? { ...channel, muted: nextKaraoke, volume: nextKaraoke ? 0 : 1 }
          : channel,
      ),
    );
  };

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.085] via-[#0e1320] to-cyan-400/[0.035] p-5 shadow-2xl sm:p-7">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.15] bg-emerald-300/[0.055] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Session ready
              </span>
              <span className="text-xs text-slate-600">{channels.length} audio {channels.length === 1 ? "output" : "outputs"}</span>
            </div>
            <h1 className="mt-4 truncate text-2xl font-bold tracking-tight text-white sm:text-3xl" title={trackName}>{trackName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span>{formatTime(duration)} duration</span>
              <span>{hasLyrics ? `${results.lyrics?.lines.length ?? 0} lyric lines` : "No lyrics requested"}</span>
              <span className="hidden sm:inline">Job {jobId.slice(0, 8)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onNewSong && <button type="button" onClick={onNewSong} className="btn-secondary">New song</button>}
            <a href="#downloads" className="btn-secondary">Downloads</a>
          </div>
        </div>
      </section>

      {hasAudio && (
        <section className="rounded-[2rem] border border-white/[0.08] bg-[#0d111d]/[0.85] p-4 shadow-xl sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={mixer.togglePlay}
              disabled={!mixer.loaded}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-[0_10px_30px_rgba(124,92,255,.25)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={mixer.isPlaying ? "Pause session" : "Play session"}
            >
              {mixer.isPlaying ? (
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z" /></svg>
              ) : (
                <svg className="ml-0.5 h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z" /></svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{mixer.isPlaying ? "Playing your mix" : mixer.loaded ? "Ready to play" : "Loading audio stems"}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatTime(mixer.currentTime)} / {formatTime(duration)} · {playbackSpeed}× speed</p>
                </div>
                {karaokeMode && <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">Karaoke mode</span>}
              </div>
            </div>
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
        <div className={`grid items-start gap-5 ${hasAudio && hasLyrics ? "lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,.98fr)]" : ""}`}>
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
    </div>
  );
}

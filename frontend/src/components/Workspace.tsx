"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DownloadPanel from "./DownloadPanel";
import LyricsPanel from "./LyricsPanel";
import StemMixer from "./StemMixer";
import StudioDeck from "./StudioDeck";
import { getJobResults, getStemAudioUrl } from "@/lib/api";
import { useStemMixer } from "@/hooks/useStemMixer";
import type { JobResultsResponse, PlaybackSpeed, PracticeTarget, StemChannelState } from "@/lib/types";

interface WorkspaceProps {
  jobId: string;
  onNewSong?: () => void;
}

const DETAIL_STEMS = new Set(["drums", "bass", "other"]);
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  gu: "Gujarati",
};

const PRACTICE_LABELS: Record<PracticeTarget, string> = {
  mix: "Full mix",
  vocals: "Vocal practice",
  drums: "Drum practice",
  bass: "Bass practice",
  other: "Guitar / keys practice",
};

function buildChannels(results: JobResultsResponse, jobId: string): StemChannelState[] {
  const hasInstrumental = results.stems.some((stem) => stem.name === "instrumental");

  return results.stems
    .filter((stem) => stem.available !== false)
    .map((stem) => ({
      name: stem.name,
      label: stem.label,
      // Instrumental is a rendered sum of drums+bass+other, so keep the detail
      // channels silent when that render is active to avoid doubled audio.
      muted:
        (hasInstrumental && stem.name === "vocals") ||
        (hasInstrumental && DETAIL_STEMS.has(stem.name)),
      solo: false,
      volume: 1,
      pan: 0,
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
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
      <div className="h-36 animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] sm:rounded-[2rem]" />
      <div className="h-52 animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] sm:rounded-[2rem]" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,.65fr)]">
        <div className="h-[520px] animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] sm:rounded-[2rem]" />
        <div className="h-[520px] animate-pulse rounded-2xl border border-white/5 bg-white/[0.025] sm:rounded-[2rem]" />
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
  const [practiceTarget, setPracticeTarget] = useState<PracticeTarget>("mix");
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [masterVolume, setMasterVolume] = useState(0.9);
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
        const startsAsKaraoke = responseHasVocals && responseHasInstrumental;
        setKaraokeMode(startsAsKaraoke);
        setPracticeTarget(startsAsKaraoke ? "vocals" : "mix");
        setMasterVolume(0.9);
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
        return { ...channel, muted: true };
      }
      return channel;
    });
  }, [channels, karaokeMode]);

  const mixer = useStemMixer({
    channels: effectiveChannels,
    playbackRate: playbackSpeed,
    masterVolume,
  });
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

  const applyPracticeTarget = useCallback((target: PracticeTarget) => {
    setPracticeTarget(target);

    if (target === "vocals") {
      setKaraokeMode(true);
      setChannels((previous) => {
        const renderedInstrumental = previous.some((channel) => channel.name === "instrumental");
        return previous.map((channel) => {
          if (channel.name === "vocals") return { ...channel, muted: true, solo: false, volume: Math.max(channel.volume, 1) };
          if (channel.name === "instrumental") return { ...channel, muted: false, solo: false, volume: Math.max(channel.volume, 1) };
          if (DETAIL_STEMS.has(channel.name)) return { ...channel, muted: renderedInstrumental, solo: false, volume: Math.max(channel.volume, 1) };
          return { ...channel, solo: false };
        });
      });
      return;
    }

    setKaraokeMode(false);
    setChannels((previous) => {
      const hasDetailTarget = previous.some((channel) => channel.name === target);
      return previous.map((channel) => {
        if (target === "mix") {
          const renderedInstrumental = previous.some((item) => item.name === "instrumental");
          if (channel.name === "instrumental") return { ...channel, muted: false, solo: false, volume: Math.max(channel.volume, 1) };
          if (DETAIL_STEMS.has(channel.name)) return { ...channel, muted: renderedInstrumental, solo: false, volume: Math.max(channel.volume, 1) };
          return { ...channel, muted: false, solo: false, volume: Math.max(channel.volume, 1) };
        }

        // Instrument practice needs the true Demucs stems, not the rendered
        // instrumental sum. Mute the target part and keep vocals + other parts.
        if (channel.name === "instrumental") return { ...channel, muted: true, solo: false };
        if (DETAIL_STEMS.has(channel.name)) {
          return { ...channel, muted: hasDetailTarget && channel.name === target, solo: false, volume: Math.max(channel.volume, 1) };
        }
        if (channel.name === "vocals") return { ...channel, muted: false, solo: false, volume: Math.max(channel.volume, 1) };
        return { ...channel, solo: false };
      });
    });
  }, []);

  const toggleVocals = useCallback(() => {
    if (!hasVocals) return;
    const vocals = channels.find((channel) => channel.name === "vocals");
    const nextMuted = !(vocals?.muted ?? false);
    setChannels((previous) =>
      previous.map((channel) =>
        channel.name === "vocals"
          ? { ...channel, muted: nextMuted, volume: Math.max(channel.volume, 1) }
          : channel,
      ),
    );
    setKaraokeMode(nextMuted && hasInstrumental);
    setPracticeTarget(nextMuted ? "vocals" : "mix");
  }, [channels, hasInstrumental, hasVocals]);

  const toggleKaraoke = useCallback(() => {
    if (!hasVocals) return;
    applyPracticeTarget(karaokeMode ? "mix" : "vocals");
  }, [applyPracticeTarget, hasVocals, karaokeMode]);

  const jumpBy = useCallback((seconds: number) => {
    mixer.seek(Math.max(0, Math.min(duration, currentTimeRef.current + seconds)));
  }, [duration, mixer.seek]);

  const loopFromNow = useCallback((seconds: number) => {
    const start = Math.max(0, Math.min(currentTimeRef.current, duration));
    const end = Math.min(duration, start + seconds);
    if (end - start < 0.5) return;
    setLoopRange({ start, end });
  }, [duration]);

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
        jumpBy(-10);
      } else if (event.key === "ArrowRight" && hasAudio) {
        event.preventDefault();
        jumpBy(10);
      } else if (event.key.toLowerCase() === "k" && hasVocals) {
        event.preventDefault();
        toggleKaraoke();
      } else if (event.key.toLowerCase() === "l" && hasAudio) {
        event.preventDefault();
        if (loopRange) setLoopRange(null);
        else loopFromNow(8);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasAudio, hasVocals, jumpBy, loopFromNow, loopRange, mixer.togglePlay, toggleKaraoke]);

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
  const requestedLanguage = typeof results.metadata.requested_language === "string" ? results.metadata.requested_language : null;
  const detectedLanguage = typeof results.metadata.detected_language === "string" ? results.metadata.detected_language : null;
  const transcriptLanguageUsed = typeof results.metadata.transcript_language_used === "string" ? results.metadata.transcript_language_used : null;
  const languageProbability = typeof results.metadata.language_probability === "number" ? results.metadata.language_probability : null;
  const effectiveLanguage = [transcriptLanguageUsed, requestedLanguage, detectedLanguage].find(
    (language): language is string => Boolean(language && LANGUAGE_LABELS[language]),
  );
  const languageLabel = effectiveLanguage ? LANGUAGE_LABELS[effectiveLanguage] : "English / Hindi / Gujarati";

  return (
    <div className="space-y-4 sm:space-y-5 xl:space-y-6">
      {hasAudio && (
        <StudioDeck
          trackName={trackName}
          practiceLabel={PRACTICE_LABELS[practiceTarget]}
          loaded={mixer.loaded}
          loadError={mixer.loadError}
          isPlaying={mixer.isPlaying}
          currentTime={mixer.currentTime}
          duration={duration}
          playbackSpeed={playbackSpeed}
          loopRange={loopRange}
          waveformUrl={waveformUrl}
          onTogglePlay={mixer.togglePlay}
          onJump={jumpBy}
          onSeek={mixer.seek}
          onSpeedChange={setPlaybackSpeed}
          onLoopFromNow={loopFromNow}
          onClearLoop={() => setLoopRange(null)}
        />
      )}

      <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-r from-violet-500/[0.055] via-[#0b101b] to-cyan-400/[0.025] p-4 shadow-xl sm:rounded-[1.75rem] sm:p-5">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/[0.12] bg-emerald-300/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Studio live
              </span>
              {hasLyrics && (
                <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] text-cyan-100/80">
                  Literal transcript · {languageLabel}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 sm:gap-x-5">
              <span>{formatTime(duration)} duration</span>
              <span>{channels.length} audio {channels.length === 1 ? "output" : "outputs"}</span>
              <span>{hasLyrics ? `${results.lyrics?.lines.length ?? 0} lyric lines` : "No lyrics requested"}</span>
              <span>{PRACTICE_LABELS[practiceTarget]}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={copySessionLink} className="btn-secondary min-w-0 px-3">{linkCopied ? "Copied" : "Copy link"}</button>
            <a href="#downloads" className="btn-secondary min-w-0 px-3">Downloads</a>
            {onNewSong && <button type="button" onClick={onNewSong} className="btn-secondary col-span-2 sm:col-span-1">New song</button>}
          </div>
        </div>
      </section>

      {(hasAudio || hasLyrics) && (
        <div className={`grid items-start gap-4 sm:gap-5 xl:gap-6 ${hasAudio && hasLyrics ? "xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,.72fr)] 2xl:grid-cols-[minmax(0,1.6fr)_minmax(430px,.7fr)]" : ""}`}>
          {hasAudio && (
            <StemMixer
              channels={channels}
              onChange={updateChannel}
              masterVolume={masterVolume}
              masterLevel={mixer.masterLevel}
              practiceTarget={practiceTarget}
              onMasterVolumeChange={setMasterVolume}
              onPracticeTarget={applyPracticeTarget}
            />
          )}
          {hasLyrics && results.lyrics && (
            <div className="xl:sticky xl:top-24">
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
                practiceLabel={PRACTICE_LABELS[practiceTarget]}
                onSeek={mixer.seek}
                onSetLoop={setLoopRange}
                onToggleKaraoke={toggleKaraoke}
                onToggleVocals={toggleVocals}
                onSpeedChange={setPlaybackSpeed}
              />
            </div>
          )}
        </div>
      )}

      {!hasAudio && hasLyrics && (
        <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] px-4 py-3 text-center text-sm text-slate-400">This is a lyrics-only result. Select an audio output next time to enable synchronized playback.</div>
      )}

      <div id="downloads">
        <DownloadPanel jobId={jobId} results={results} />
      </div>

      {hasAudio && (
        <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0f1b]/95 p-2.5 shadow-2xl backdrop-blur-xl sm:hidden">
          <button type="button" onClick={() => jumpBy(-10)} disabled={!mixer.loaded} className="mobile-transport-button" aria-label="Go back 10 seconds">-10</button>
          <button type="button" onClick={mixer.togglePlay} disabled={!mixer.loaded} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white disabled:opacity-40" aria-label={mixer.isPlaying ? "Pause session" : "Play session"}>
            <TransportIcon playing={mixer.isPlaying} />
          </button>
          <button type="button" onClick={() => jumpBy(10)} disabled={!mixer.loaded} className="mobile-transport-button" aria-label="Go forward 10 seconds">+10</button>
          <div className="min-w-0 flex-1 text-right">
            <p className="font-mono text-[11px] tabular-nums text-slate-300">{formatTime(mixer.currentTime)}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-600">{PRACTICE_LABELS[practiceTarget]}</p>
          </div>
        </div>
      )}
    </div>
  );
}

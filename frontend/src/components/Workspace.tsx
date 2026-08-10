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
}

const DETAIL_STEMS = new Set(["drums", "bass", "other"]);

function buildChannels(results: JobResultsResponse, jobId: string): StemChannelState[] {
  const hasInstrumental = results.stems.some((s) => s.name === "instrumental");

  return results.stems.map((s) => ({
    name: s.name,
    label: s.label,
    // When an instrumental exists, start in karaoke mode and keep individual
    // accompaniment stems muted to avoid doubling the same music.
    muted:
      (hasInstrumental && s.name === "vocals") ||
      (hasInstrumental && DETAIL_STEMS.has(s.name)),
    solo: false,
    volume: 1,
    url: getStemAudioUrl(jobId, s.filename),
  }));
}

export default function Workspace({ jobId }: WorkspaceProps) {
  const [results, setResults] = useState<JobResultsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [channels, setChannels] = useState<StemChannelState[]>([]);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    setLoadError(null);
    getJobResults(jobId)
      .then((r) => {
        setResults(r);
        setChannels(buildChannels(r, jobId));
        const hasVocals = r.stems.some((s) => s.name === "vocals");
        const hasInstrumental = r.stems.some((s) => s.name === "instrumental");
        setKaraokeMode(hasVocals && hasInstrumental);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Could not load job results");
      });
  }, [jobId]);

  const effectiveChannels = useMemo(() => {
    return channels.map((ch) => {
      if (karaokeMode && ch.name === "vocals") {
        return { ...ch, muted: true, volume: 0 };
      }
      return ch;
    });
  }, [channels, karaokeMode]);

  const mixer = useStemMixer({ channels: effectiveChannels, playbackRate: playbackSpeed });

  useEffect(() => {
    if (!loopRange || !mixer.isPlaying) return;
    if (mixer.currentTime >= loopRange.end) {
      mixer.seek(loopRange.start);
    }
  }, [mixer.currentTime, loopRange, mixer]);

  const updateChannel = useCallback((name: string, patch: Partial<StemChannelState>) => {
    setChannels((prev) => prev.map((c) => (c.name === name ? { ...c, ...patch } : c)));
    if (name === "vocals" && "muted" in patch) {
      setKaraokeMode(!!patch.muted);
    }
  }, []);

  if (loadError) {
    return (
      <div className="card mx-auto max-w-xl border-red-500/30 text-center">
        <h2 className="mb-2 text-lg font-semibold text-red-400">Could not load results</h2>
        <p className="text-sm text-gray-400">{loadError}</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const hasAudio = channels.length > 0;
  const hasLyrics = results.lyrics !== null;
  const hasVocals = channels.some((c) => c.name === "vocals");
  const hasInstrumental = channels.some((c) => c.name === "instrumental");
  const waveformStem =
    results.stems.find((s) => s.name === "instrumental") ||
    results.stems.find((s) => s.name === "vocals") ||
    results.stems[0];
  const waveformUrl = waveformStem ? getStemAudioUrl(jobId, waveformStem.filename) : "";
  const vocalsMuted = channels.find((c) => c.name === "vocals")?.muted ?? true;

  const toggleVocals = () => {
    if (!hasVocals) return;
    setChannels((prev) =>
      prev.map((c) => (c.name === "vocals" ? { ...c, muted: !c.muted, volume: c.muted ? 1 : 0 } : c)),
    );
    setKaraokeMode((k) => !k);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {hasAudio && (
          <button type="button" onClick={mixer.togglePlay} className="btn-primary flex items-center gap-2">
            {mixer.isPlaying ? (
              <>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
                Play
              </>
            )}
          </button>
        )}
        {hasAudio && !mixer.loaded && <span className="text-sm text-gray-400">Loading audio...</span>}
        <span className="text-sm text-gray-500">{results.metadata.original_filename as string}</span>
      </div>

      {waveformUrl && (
        <WaveformPlayer
          url={waveformUrl}
          currentTime={mixer.currentTime}
          duration={mixer.duration}
          isPlaying={mixer.isPlaying}
          onSeek={mixer.seek}
          loopRange={loopRange}
        />
      )}

      {(hasAudio || hasLyrics) && (
        <div className={`grid gap-6 ${hasAudio && hasLyrics ? "lg:grid-cols-2" : ""}`}>
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
              onToggleKaraoke={() => {
                if (!hasVocals || !hasInstrumental) return;
                setKaraokeMode((k) => !k);
                setChannels((prev) =>
                  prev.map((c) =>
                    c.name === "vocals" ? { ...c, muted: !karaokeMode, volume: karaokeMode ? 1 : 0 } : c,
                  ),
                );
              }}
              onToggleVocals={toggleVocals}
              onSpeedChange={setPlaybackSpeed}
            />
          )}
        </div>
      )}

      {!hasAudio && hasLyrics && (
        <p className="text-center text-sm text-gray-500">
          You requested lyrics only, so no audio stem is returned for playback.
        </p>
      )}

      <DownloadPanel jobId={jobId} results={results} />
    </div>
  );
}

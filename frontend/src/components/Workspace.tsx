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

function buildChannels(results: JobResultsResponse, jobId: string): StemChannelState[] {
  return results.stems.map((s) => ({
    name: s.name,
    label: s.label,
    muted: s.name === "vocals",
    solo: false,
    volume: 1,
    url: getStemAudioUrl(jobId, s.filename),
  }));
}

export default function Workspace({ jobId }: WorkspaceProps) {
  const [results, setResults] = useState<JobResultsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [channels, setChannels] = useState<StemChannelState[]>([]);
  const [karaokeMode, setKaraokeMode] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    setLoadError(null);
    getJobResults(jobId)
      .then((r) => {
        setResults(r);
        setChannels(buildChannels(r, jobId));
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

  const waveformUrl = results
    ? getStemAudioUrl(jobId, "instrumental.wav")
    : "";

  const vocalsMuted = channels.find((c) => c.name === "vocals")?.muted ?? true;

  const toggleVocals = () => {
    setChannels((prev) =>
      prev.map((c) => (c.name === "vocals" ? { ...c, muted: !c.muted, volume: c.muted ? 1 : 0 } : c)),
    );
    setKaraokeMode((k) => !k);
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
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
        {!mixer.loaded && <span className="text-sm text-gray-400">Loading audio...</span>}
        <span className="text-sm text-gray-500">
          {results.metadata.original_filename as string}
        </span>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <StemMixer channels={channels} onChange={updateChannel} />
        <LyricsPanel
          lines={results.lyrics?.lines || []}
          currentTime={mixer.currentTime}
          karaokeMode={karaokeMode}
          vocalsMuted={vocalsMuted}
          playbackSpeed={playbackSpeed}
          loopRange={loopRange}
          onSeek={mixer.seek}
          onSetLoop={setLoopRange}
          onToggleKaraoke={() => {
            setKaraokeMode((k) => !k);
            setChannels((prev) =>
              prev.map((c) =>
                c.name === "vocals" ? { ...c, muted: !karaokeMode, volume: karaokeMode ? 0 : 1 } : c,
              ),
            );
          }}
          onToggleVocals={toggleVocals}
          onSpeedChange={setPlaybackSpeed}
        />
      </div>

      <DownloadPanel jobId={jobId} results={results} />
    </div>
  );
}

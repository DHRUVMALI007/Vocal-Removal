import { formatTime } from "../utils/formatTime";
import { useLyricsSync } from "../hooks/useLyricsSync";
import { PLAYBACK_SPEEDS } from "../utils/audio";

export default function KaraokePanel({
  lines,
  currentTime,
  onSeek,
  vocalsMuted,
  onToggleVocals,
  playbackSpeed,
  onSpeedChange,
  loopRange,
  onClearLoop,
}) {
  const { activeIndex, activeRef } = useLyricsSync(lines, currentTime);
  const current = activeIndex >= 0 ? lines[activeIndex] : null;

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Karaoke</h3>
        <button type="button" className="btn-secondary ml-auto text-xs" onClick={onToggleVocals}>
          {vocalsMuted ? "Reference Vocals Off" : "Reference Vocals On"}
        </button>
        <div className="flex gap-1">
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              className={`min-h-[36px] rounded px-2 text-xs ${playbackSpeed === s ? "bg-accent text-white" : "bg-surface-border text-gray-400"}`}
            >
              {s}x
            </button>
          ))}
        </div>
        {loopRange && (
          <button type="button" className="btn-secondary text-xs text-red-400" onClick={onClearLoop}>
            Clear Loop
          </button>
        )}
      </div>

      {current ? (
        <div
          ref={activeRef}
          className="mb-4 rounded-xl bg-gradient-to-r from-accent/20 to-blue-500/10 px-4 py-6 text-center text-xl font-semibold leading-relaxed sm:text-2xl"
        >
          {current.text}
        </div>
      ) : (
        <p className="mb-4 text-center text-gray-500">Press play to start karaoke</p>
      )}

      <div className="max-h-48 overflow-y-auto space-y-1">
        {lines?.map((line, i) => (
          <button
            key={`k-${line.start}-${i}`}
            type="button"
            onClick={() => onSeek(line.start)}
            className={`block w-full rounded px-2 py-1 text-left text-sm ${
              i === activeIndex ? "text-accent-light" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {formatTime(line.start)} · {line.text}
          </button>
        ))}
      </div>
    </div>
  );
}

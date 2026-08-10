import { formatTime } from "../utils/formatTime";
import { PLAYBACK_SPEEDS } from "../utils/audio";

export default function PlaybackControls({
  isPlaying,
  loaded,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
  currentTime,
  duration,
}) {
  return (
    <div className="card flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={!loaded}
        className="btn-primary flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 px-4"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        ) : (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5z" /></svg>
        )}
        <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
      </button>

      <span className="text-sm text-gray-400 tabular-nums">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <div className="ml-auto flex gap-1" role="group" aria-label="Playback speed">
        {PLAYBACK_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeedChange(s)}
            className={`min-h-[36px] min-w-[44px] rounded px-2 text-xs ${
              playbackSpeed === s ? "bg-accent text-white" : "bg-surface-border text-gray-400"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

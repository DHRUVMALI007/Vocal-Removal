import { STEM_COLORS } from "../utils/audio";

export default function StemChannel({ channel, onChange }) {
  const color = STEM_COLORS[channel.name] || "#64748b";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-elevated px-3 py-2 sm:gap-3">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="w-full min-w-0 truncate text-sm sm:w-24">{channel.label}</span>

      <div className="flex gap-1">
        <button
          type="button"
          aria-label={`Mute ${channel.label}`}
          aria-pressed={channel.muted}
          onClick={() => onChange({ muted: !channel.muted })}
          className={`min-h-[36px] min-w-[36px] rounded text-xs font-bold ${
            channel.muted ? "bg-red-500/30 text-red-400" : "bg-surface-border text-gray-400"
          }`}
        >
          M
        </button>
        <button
          type="button"
          aria-label={`Solo ${channel.label}`}
          aria-pressed={channel.solo}
          onClick={() => onChange({ solo: !channel.solo })}
          className={`min-h-[36px] min-w-[36px] rounded text-xs font-bold ${
            channel.solo ? "bg-yellow-500/30 text-yellow-400" : "bg-surface-border text-gray-400"
          }`}
        >
          S
        </button>
        <button
          type="button"
          aria-label={`Reset ${channel.label}`}
          onClick={() => onChange({ muted: false, solo: false, volume: 1 })}
          className="min-h-[36px] min-w-[36px] rounded bg-surface-border text-xs text-gray-400"
        >
          R
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={channel.volume}
        aria-label={`Volume ${channel.label}`}
        onChange={(e) => onChange({ volume: parseFloat(e.target.value) })}
        className="slider-track min-w-[80px] flex-1"
      />
      <span className="w-8 text-right text-xs text-gray-500">{Math.round(channel.volume * 100)}</span>
    </div>
  );
}

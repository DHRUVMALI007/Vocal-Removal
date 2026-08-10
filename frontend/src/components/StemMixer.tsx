"use client";

import type { StemChannelState } from "@/lib/types";

interface StemMixerProps {
  channels: StemChannelState[];
  onChange: (name: string, patch: Partial<StemChannelState>) => void;
}

const STEM_COLORS: Record<string, string> = {
  vocals: "bg-pink-500",
  instrumental: "bg-purple-500",
  drums: "bg-orange-500",
  bass: "bg-blue-500",
  other: "bg-teal-500",
};

export default function StemMixer({ channels, onChange }: StemMixerProps) {
  const toggleSolo = (name: string) => {
    const ch = channels.find((c) => c.name === name);
    if (!ch) return;
    onChange(name, { solo: !ch.solo });
  };

  return (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Stem Mixer</h3>
      <div className="space-y-3">
        {channels.map((ch) => (
          <div key={ch.name} className="flex items-center gap-3 rounded-lg bg-surface-elevated px-3 py-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${STEM_COLORS[ch.name] || "bg-gray-500"}`} />
            <span className="w-28 shrink-0 truncate text-sm">{ch.label}</span>

            <button
              type="button"
              aria-label={`Mute ${ch.label}`}
              onClick={() => onChange(ch.name, { muted: !ch.muted })}
              className={`w-8 rounded text-xs font-bold ${ch.muted ? "bg-red-500/30 text-red-400" : "bg-surface-border text-gray-400 hover:text-white"}`}
            >
              M
            </button>

            <button
              type="button"
              aria-label={`Solo ${ch.label}`}
              onClick={() => toggleSolo(ch.name)}
              className={`w-8 rounded text-xs font-bold ${ch.solo ? "bg-yellow-500/30 text-yellow-400" : "bg-surface-border text-gray-400 hover:text-white"}`}
            >
              S
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={ch.volume}
              aria-label={`Volume ${ch.label}`}
              onChange={(e) => onChange(ch.name, { volume: parseFloat(e.target.value) })}
              className="slider-track flex-1"
            />

            <span className="w-8 text-right text-xs text-gray-500">{Math.round(ch.volume * 100)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Stems from HTDemucs: vocals, drums, bass, other. No dedicated guitar/tabla stems — add specialized models later.
      </p>
    </div>
  );
}

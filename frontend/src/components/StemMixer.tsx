"use client";

import type { StemChannelState } from "@/lib/types";

interface StemMixerProps {
  channels: StemChannelState[];
  onChange: (name: string, patch: Partial<StemChannelState>) => void;
}

const STEM_COLORS: Record<string, { dot: string; glow: string }> = {
  vocals: { dot: "bg-pink-400", glow: "from-pink-500/[0.12]" },
  instrumental: { dot: "bg-violet-400", glow: "from-violet-500/[0.12]" },
  drums: { dot: "bg-orange-400", glow: "from-orange-500/[0.12]" },
  bass: { dot: "bg-blue-400", glow: "from-blue-500/[0.12]" },
  other: { dot: "bg-teal-400", glow: "from-teal-500/[0.12]" },
};

export default function StemMixer({ channels, onChange }: StemMixerProps) {
  const anySolo = channels.some((channel) => channel.solo);

  return (
    <section className="rounded-[2rem] border border-white/[0.08] bg-[#0d111d]/[0.85] p-5 shadow-xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Mixer</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Shape the practice mix</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Mute, solo, or blend each available stem in real time.</p>
        </div>
        {anySolo && <span className="rounded-full border border-amber-300/[0.15] bg-amber-300/[0.055] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">Solo active</span>}
      </div>

      <div className="mt-6 space-y-3">
        {channels.map((channel) => {
          const color = STEM_COLORS[channel.name] || { dot: "bg-slate-400", glow: "from-slate-500/10" };
          const audible = (!anySolo || channel.solo) && !channel.muted && channel.volume > 0;
          return (
            <div
              key={channel.name}
              className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                audible ? "border-white/[0.08] bg-white/[0.035]" : "border-white/5 bg-black/10 opacity-75"
              }`}
            >
              <div className={`pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r ${color.glow} to-transparent`} aria-hidden="true" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3 sm:w-36 sm:shrink-0">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.dot} ${audible ? "shadow-[0_0_12px_currentColor]" : "opacity-45"}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-200">{channel.label}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-600">{audible ? "Audible" : "Muted in mix"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Mute ${channel.label}`}
                    aria-pressed={channel.muted}
                    onClick={() => onChange(channel.name, { muted: !channel.muted })}
                    className={`mixer-toggle ${channel.muted ? "border-red-400/25 bg-red-400/10 text-red-300" : ""}`}
                  >
                    Mute
                  </button>
                  <button
                    type="button"
                    aria-label={`Solo ${channel.label}`}
                    aria-pressed={channel.solo}
                    onClick={() => onChange(channel.name, { solo: !channel.solo })}
                    className={`mixer-toggle ${channel.solo ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : ""}`}
                  >
                    Solo
                  </button>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={channel.volume}
                    aria-label={`Volume ${channel.label}`}
                    onChange={(event) => onChange(channel.name, { volume: Number.parseFloat(event.target.value) })}
                    className="slider-track flex-1"
                  />
                  <span className="w-10 text-right font-mono text-xs tabular-nums text-slate-500">{Math.round(channel.volume * 100)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
        <p className="text-xs leading-5 text-slate-600">Instrumental is the combined non-vocal mix. Keep detail stems muted with it to avoid doubling.</p>
        <button
          type="button"
          onClick={() => channels.forEach((channel) => onChange(channel.name, { muted: false, solo: false, volume: 1 }))}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-200"
        >
          Reset mixer
        </button>
      </div>
    </section>
  );
}

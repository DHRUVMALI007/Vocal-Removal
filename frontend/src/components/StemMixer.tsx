"use client";

import type { StemChannelState } from "@/lib/types";

interface StemMixerProps {
  channels: StemChannelState[];
  onChange: (name: string, patch: Partial<StemChannelState>) => void;
}

const DETAIL_STEMS = new Set(["drums", "bass", "other"]);

const STEM_COLORS: Record<string, { dot: string; glow: string }> = {
  vocals: { dot: "bg-pink-400", glow: "from-pink-500/[0.12]" },
  instrumental: { dot: "bg-violet-400", glow: "from-violet-500/[0.12]" },
  drums: { dot: "bg-orange-400", glow: "from-orange-500/[0.12]" },
  bass: { dot: "bg-blue-400", glow: "from-blue-500/[0.12]" },
  other: { dot: "bg-teal-400", glow: "from-teal-500/[0.12]" },
};

export default function StemMixer({ channels, onChange }: StemMixerProps) {
  const anySolo = channels.some((channel) => channel.solo);
  const hasVocals = channels.some((channel) => channel.name === "vocals");
  const hasInstrumental = channels.some((channel) => channel.name === "instrumental");
  const hasNonVocal = channels.some((channel) => channel.name !== "vocals");

  const applyPreset = (preset: "balanced" | "karaoke" | "vocals") => {
    const hasRenderedInstrumental = channels.some((channel) => channel.name === "instrumental");

    channels.forEach((channel) => {
      if (preset === "vocals") {
        onChange(channel.name, {
          muted: false,
          solo: channel.name === "vocals",
          volume: 1,
        });
        return;
      }

      if (preset === "karaoke") {
        const shouldMute =
          channel.name === "vocals" ||
          (hasRenderedInstrumental && DETAIL_STEMS.has(channel.name));
        onChange(channel.name, { muted: shouldMute, solo: false, volume: 1 });
        return;
      }

      const shouldMute = hasRenderedInstrumental && DETAIL_STEMS.has(channel.name);
      onChange(channel.name, { muted: shouldMute, solo: false, volume: 1 });
    });
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0d111d]/[0.85] p-4 shadow-xl sm:rounded-[2rem] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Mixer</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Shape the practice mix</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Mute, solo, blend, or jump to a useful mix preset.</p>
        </div>
        {anySolo && (
          <span className="self-start rounded-full border border-amber-300/[0.15] bg-amber-300/[0.055] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
            Solo active
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Quick mixer presets">
        <button type="button" onClick={() => applyPreset("balanced")} className="mixer-preset">Balanced</button>
        {hasNonVocal && <button type="button" onClick={() => applyPreset("karaoke")} className="mixer-preset">Karaoke</button>}
        {hasVocals && <button type="button" onClick={() => applyPreset("vocals")} className="mixer-preset">Vocals only</button>}
        {hasInstrumental && (
          <span className="col-span-2 self-center px-1 text-[10px] leading-4 text-slate-600 sm:ml-auto sm:max-w-52 sm:text-right">
            Instrumental already contains the accompaniment.
          </span>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {channels.map((channel) => {
          const color = STEM_COLORS[channel.name] || { dot: "bg-slate-400", glow: "from-slate-500/10" };
          const audible = (!anySolo || channel.solo) && !channel.muted && channel.volume > 0;
          return (
            <div
              key={channel.name}
              className={`relative overflow-hidden rounded-2xl border p-3.5 transition-all sm:p-4 ${
                audible ? "border-white/[0.08] bg-white/[0.035]" : "border-white/5 bg-black/10 opacity-75"
              }`}
            >
              <div className={`pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r ${color.glow} to-transparent`} aria-hidden="true" />
              <div className="relative grid gap-3 sm:grid-cols-[9rem_auto_minmax(120px,1fr)] sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
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
                    className={`mixer-toggle flex-1 sm:flex-none ${channel.muted ? "border-red-400/25 bg-red-400/10 text-red-300" : ""}`}
                  >
                    Mute
                  </button>
                  <button
                    type="button"
                    aria-label={`Solo ${channel.label}`}
                    aria-pressed={channel.solo}
                    onClick={() => onChange(channel.name, { solo: !channel.solo })}
                    className={`mixer-toggle flex-1 sm:flex-none ${channel.solo ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : ""}`}
                  >
                    Solo
                  </button>
                </div>

                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={channel.volume}
                    aria-label={`Volume ${channel.label}`}
                    onChange={(event) => onChange(channel.name, { volume: Number.parseFloat(event.target.value) })}
                    className="slider-track min-w-0 flex-1"
                  />
                  <span className="w-10 text-right font-mono text-xs tabular-nums text-slate-500">{Math.round(channel.volume * 100)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-600">Presets keep combined instrumental and detail stems from doubling each other.</p>
        <button
          type="button"
          onClick={() => applyPreset("balanced")}
          className="self-start text-xs font-medium text-slate-500 transition hover:text-slate-200 sm:self-auto"
        >
          Reset balanced mix
        </button>
      </div>
    </section>
  );
}

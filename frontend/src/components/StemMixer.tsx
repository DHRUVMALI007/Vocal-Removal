"use client";

import React from "react";
import type { PracticeTarget, StemChannelState } from "@/lib/types";

interface StemMixerProps {
  channels: StemChannelState[];
  onChange: (name: string, patch: Partial<StemChannelState>) => void;
  masterVolume: number;
  masterLevel: number;
  practiceTarget: PracticeTarget;
  onMasterVolumeChange: (volume: number) => void;
  onPracticeTarget: (target: PracticeTarget) => void;
}

const STEM_COLORS: Record<string, { dot: string; border: string; glow: string; text: string }> = {
  vocals: { dot: "bg-pink-400", border: "border-pink-400/20", glow: "from-pink-500/[0.14]", text: "text-pink-200" },
  instrumental: { dot: "bg-violet-400", border: "border-violet-400/20", glow: "from-violet-500/[0.14]", text: "text-violet-200" },
  drums: { dot: "bg-orange-400", border: "border-orange-400/20", glow: "from-orange-500/[0.14]", text: "text-orange-200" },
  bass: { dot: "bg-blue-400", border: "border-blue-400/20", glow: "from-blue-500/[0.14]", text: "text-blue-200" },
  other: { dot: "bg-teal-400", border: "border-teal-400/20", glow: "from-teal-500/[0.14]", text: "text-teal-200" },
};

const PRACTICE_LABELS: Record<PracticeTarget, string> = {
  mix: "Full mix",
  vocals: "Sing",
  drums: "Drums",
  bass: "Bass",
  other: "Guitar / keys",
};

function formatDb(value: number) {
  if (Math.abs(value) < 0.05) return "0";
  return `${value > 0 ? "+" : ""}${value.toFixed(0)}`;
}

export default function StemMixer({
  channels,
  onChange,
  masterVolume,
  masterLevel,
  practiceTarget,
  onMasterVolumeChange,
  onPracticeTarget,
}: StemMixerProps) {
  const anySolo = channels.some((channel) => channel.solo);
  const availablePracticeTargets: PracticeTarget[] = ["mix"];
  if (channels.some((channel) => channel.name === "vocals")) availablePracticeTargets.push("vocals");
  if (channels.some((channel) => channel.name === "drums")) availablePracticeTargets.push("drums");
  if (channels.some((channel) => channel.name === "bass")) availablePracticeTargets.push("bass");
  if (channels.some((channel) => channel.name === "other")) availablePracticeTargets.push("other");

  const resetSound = () => {
    channels.forEach((channel) => {
      onChange(channel.name, {
        solo: false,
        volume: 1,
        pan: 0,
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
      });
    });
    onMasterVolumeChange(0.9);
    onPracticeTarget("mix");
  };

  return (
    <section className="dj-console rounded-2xl border border-white/[0.09] bg-[#090d16]/95 p-3 shadow-2xl sm:rounded-[2rem] sm:p-5 xl:p-6">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">DJ stem console</p>
            {anySolo && (
              <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.055] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200">Cue / solo active</span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Mix the band around your practice</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Per-stem 3-band EQ, pan, gain, mute and cue. Practice presets remove the part you want to perform while the rest of the song and lyrics continue.</p>
        </div>
        <button type="button" onClick={resetSound} className="btn-secondary self-start px-3 py-2 text-xs lg:self-auto">Reset console</button>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-white/[0.06] bg-black/15 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Practice target</p>
              <p className="mt-1 text-xs text-slate-500">Choose what you want to perform.</p>
            </div>
            <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/75">{PRACTICE_LABELS[practiceTarget]}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">
            {availablePracticeTargets.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => onPracticeTarget(target)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${practiceTarget === target
                  ? "border-violet-400/25 bg-violet-500/10 text-violet-100 shadow-[0_0_22px_rgba(124,92,255,.08)]"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/[0.12] hover:text-slate-200"
                  }`}
              >
                {PRACTICE_LABELS[target]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-600">For drums, bass, or guitar/keys practice, create the session with the <strong className="font-semibold text-slate-500">Band practice</strong> preset so those stems exist independently.</p>
        </div>

        <div className="rounded-2xl border border-violet-400/[0.12] bg-gradient-to-br from-violet-500/[0.08] to-cyan-400/[0.03] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Master out</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-slate-400">{Math.round(masterVolume * 100)}%</p>
            </div>
            <div className="flex h-10 items-end gap-1" aria-label={`Master level ${Math.round(masterLevel * 100)} percent`}>
              {Array.from({ length: 10 }, (_, index) => {
                const threshold = (index + 1) / 10;
                const active = masterLevel >= threshold;
                const color = index > 7 ? "bg-rose-400" : index > 5 ? "bg-amber-300" : "bg-emerald-300";
                return <span key={index} className={`w-1.5 rounded-sm transition ${color} ${active ? "opacity-100" : "opacity-15"}`} style={{ height: `${20 + index * 2}px` }} />;
              })}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={1.25}
            step={0.01}
            value={masterVolume}
            onChange={(event) => onMasterVolumeChange(Number.parseFloat(event.target.value))}
            className="slider-track mt-4 w-full"
            aria-label="Master volume"
          />
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${channels.length >= 5 ? "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5" : channels.length >= 4 ? "md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {channels.map((channel) => {
          const color = STEM_COLORS[channel.name] || { dot: "bg-slate-400", border: "border-slate-400/20", glow: "from-slate-500/10", text: "text-slate-200" };
          const audible = (!anySolo || channel.solo) && !channel.muted && channel.volume > 0;
          return (
            <article
              key={channel.name}
              className={`relative overflow-hidden rounded-2xl border p-3.5 transition-all sm:p-4 ${audible ? `${color.border} bg-[#101522]` : "border-white/5 bg-black/15 opacity-70"}`}
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${color.glow} to-transparent`} aria-hidden="true" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.dot} ${audible ? "shadow-[0_0_14px_currentColor]" : "opacity-40"}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{channel.label}</p>
                      <p className={`mt-0.5 text-[9px] font-bold uppercase tracking-[0.13em] ${audible ? color.text : "text-slate-700"}`}>{audible ? "On air" : "Silent"}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-slate-600">CH</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
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
                    Cue
                  </button>
                </div>

                <div className="mt-4 space-y-3 rounded-xl border border-white/[0.05] bg-black/15 p-3">
                  {([
                    ["LOW", "eqLow"],
                    ["MID", "eqMid"],
                    ["HIGH", "eqHigh"],
                  ] as const).map(([label, key]) => (
                    <label key={key} className="block">
                      <span className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
                        <span>{label}</span>
                        <span className="font-mono text-slate-500">{formatDb(channel[key])} dB</span>
                      </span>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        value={channel[key]}
                        onChange={(event) => onChange(channel.name, { [key]: Number.parseFloat(event.target.value) })}
                        className="slider-track w-full"
                        aria-label={`${label} EQ ${channel.label}`}
                      />
                    </label>
                  ))}
                </div>

                <label className="mt-3 block">
                  <span className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    <span>Pan</span>
                    <span className="font-mono text-slate-500">{channel.pan === 0 ? "C" : channel.pan < 0 ? `L${Math.round(Math.abs(channel.pan) * 100)}` : `R${Math.round(channel.pan * 100)}`}</span>
                  </span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.02}
                    value={channel.pan}
                    onChange={(event) => onChange(channel.name, { pan: Number.parseFloat(event.target.value) })}
                    className="slider-track w-full"
                    aria-label={`Pan ${channel.label}`}
                  />
                </label>

                <label className="mt-4 block border-t border-white/5 pt-3">
                  <span className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    <span>Channel gain</span>
                    <span className="font-mono text-slate-400">{Math.round(channel.volume * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1.25}
                    step={0.01}
                    value={channel.volume}
                    aria-label={`Volume ${channel.label}`}
                    onChange={(event) => onChange(channel.name, { volume: Number.parseFloat(event.target.value) })}
                    className="dj-volume-fader slider-track w-full"
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

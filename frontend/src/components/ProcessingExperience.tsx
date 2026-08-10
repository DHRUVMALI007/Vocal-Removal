"use client";

import type { JobStatusResponse, ProcessingStep } from "@/lib/types";

interface ProcessingExperienceProps {
  status: JobStatusResponse | null;
  trackName?: string | null;
  onStartOver?: () => void;
}

const STAGES: Array<{ key: ProcessingStep | "queued"; label: string; detail: string; threshold: number }> = [
  { key: "normalize", label: "Prepare audio", detail: "Normalize the source for analysis", threshold: 10 },
  { key: "separate", label: "Split the mix", detail: "Separate the requested musical sources", threshold: 30 },
  { key: "transcribe", label: "Build practice data", detail: "Create instrumental and/or lyric timing", threshold: 70 },
  { key: "finalize", label: "Finish session", detail: "Package your playable results", threshold: 94 },
];

const TIPS = [
  "Your final workspace keeps every selected stem on one synchronized timeline.",
  "Use Solo in the mixer to focus on one instrument without changing the others.",
  "Lyric loop mode is useful for rehearsing a difficult phrase repeatedly.",
  "You can slow playback to 0.5× or 0.75× from the lyrics practice panel.",
  "Download only the stems you need, or grab the entire session as a ZIP.",
];

function stageState(index: number, progress: number, currentStep?: ProcessingStep | null) {
  const stage = STAGES[index];
  const nextThreshold = STAGES[index + 1]?.threshold ?? 101;
  if (progress >= nextThreshold || progress >= 100) return "done";
  if ((index === 0 && progress < stage.threshold) || currentStep === stage.key || (progress >= stage.threshold && progress < nextThreshold)) return "active";
  return "upcoming";
}

export default function ProcessingExperience({ status, trackName, onStartOver }: ProcessingExperienceProps) {
  const progress = Math.max(0, Math.min(100, status?.progress ?? 0));
  const tip = TIPS[Math.floor(progress / 19) % TIPS.length];

  return (
    <section className="relative min-h-[76vh] overflow-hidden">
      <div className="music-grid absolute inset-0 opacity-25" aria-hidden="true" />
      <div className="absolute left-1/2 top-16 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[.88fr_1.12fr]">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="processing-orbit" aria-hidden="true">
              <div className="processing-orbit-ring processing-orbit-ring-one" />
              <div className="processing-orbit-ring processing-orbit-ring-two" />
              <div className="processing-core">
                <div className="flex h-20 items-end gap-1.5">
                  {[28, 46, 62, 38, 72, 50, 34].map((height, index) => (
                    <span
                      key={index}
                      className="eq-bar w-2 rounded-full bg-gradient-to-t from-violet-500 to-cyan-300"
                      style={{ height: `${height}%`, animationDelay: `${index * 0.12}s` }}
                    />
                  ))}
                </div>
              </div>
              <div className="processing-note processing-note-one">♪</div>
              <div className="processing-note processing-note-two">♫</div>
            </div>

            <div className="mt-8">
              <div className="eyebrow mx-auto mb-4 w-fit lg:mx-0">AI SESSION IN PROGRESS</div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">We’re building your mix.</h1>
              <p className="mt-3 max-w-lg text-sm leading-7 text-slate-400">
                {status?.message || "Preparing the processing pipeline…"}
              </p>
              {trackName && (
                <p className="mt-3 max-w-lg truncate text-xs text-slate-600" title={trackName}>{trackName}</p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/[0.08] bg-[#0d111d]/80 p-5 shadow-2xl backdrop-blur sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Session progress</p>
                <p className="mt-1 text-2xl font-semibold text-white">{Math.round(progress)}%</p>
              </div>
              <span className="rounded-full border border-cyan-300/[0.15] bg-cyan-300/[0.055] px-3 py-1.5 text-xs font-medium text-cyan-200">
                Keep this tab open
              </span>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.055]">
              <div className="progress-glow h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-cyan-300 transition-[width] duration-700 ease-out" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-7 space-y-3">
              {STAGES.map((stage, index) => {
                const state = stageState(index, progress, status?.step);
                return (
                  <div
                    key={stage.key}
                    className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                      state === "active"
                        ? "border-violet-400/25 bg-violet-500/[0.075]"
                        : state === "done"
                          ? "border-emerald-400/10 bg-emerald-400/[0.035]"
                          : "border-white/5 bg-black/10"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${
                      state === "done"
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : state === "active"
                          ? "border-violet-400/25 bg-violet-500/[0.15] text-violet-200"
                          : "border-white/5 bg-white/[0.025] text-slate-600"
                    }`}>
                      {state === "done" ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 12 4 4L19 6" /></svg>
                      ) : state === "active" ? (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-violet-300" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${state === "upcoming" ? "text-slate-500" : "text-slate-200"}`}>{stage.label}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{stage.detail}</p>
                    </div>
                    {state === "active" && <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">Working</span>}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.025] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-xs font-bold text-cyan-200">i</div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">While you wait</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{tip}</p>
                </div>
              </div>
            </div>

            {onStartOver && (
              <button type="button" onClick={onStartOver} className="mt-5 text-xs text-slate-600 transition hover:text-slate-300">
                Start a different session instead
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

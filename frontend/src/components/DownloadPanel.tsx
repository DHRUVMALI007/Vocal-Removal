"use client";

import { getDownloadUrl } from "@/lib/api";
import type { JobResultsResponse } from "@/lib/types";

interface DownloadPanelProps {
  jobId: string;
  results: JobResultsResponse;
}

const STEM_TONES: Record<string, string> = {
  vocals: "text-pink-300 bg-pink-400/10 border-pink-400/[0.15]",
  instrumental: "text-violet-200 bg-violet-400/10 border-violet-400/[0.15]",
  drums: "text-orange-200 bg-orange-400/10 border-orange-400/[0.15]",
  bass: "text-blue-200 bg-blue-400/10 border-blue-400/[0.15]",
  other: "text-teal-200 bg-teal-400/10 border-teal-400/[0.15]",
};

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export default function DownloadPanel({ jobId, results }: DownloadPanelProps) {
  const lyricItems = [
    results.download_urls.lyrics_txt ? { key: "lyrics_txt", label: "Lyrics TXT", filename: "lyrics.txt", detail: "Literal transcript" } : null,
    results.download_urls.lyrics_srt ? { key: "lyrics_srt", label: "Lyrics SRT", filename: "lyrics.srt", detail: "Synced timing" } : null,
    results.download_urls.lyrics_lrc ? { key: "lyrics_lrc", label: "Lyrics LRC", filename: "lyrics.lrc", detail: "Synced lyric format" } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; filename: string; detail: string }>;

  return (
    <section className="rounded-[2rem] border border-white/[0.08] bg-[#0d111d]/[0.85] p-5 shadow-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Export</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Take the session with you</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Download individual outputs or package everything into one ZIP.</p>
        </div>
        <a href={getDownloadUrl(jobId, "all.zip")} download className="btn-primary shrink-0">
          <DownloadIcon />
          Download all
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.stems.map((stem) => (
          <a
            key={stem.name}
            href={getDownloadUrl(jobId, stem.filename)}
            download
            className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${STEM_TONES[stem.name] || "border-white/[0.08] bg-white/[0.04] text-slate-300"}`}>
              <DownloadIcon />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-200">{stem.label}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">WAV stem</p>
            </div>
            <span className="text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-slate-400" aria-hidden="true">→</span>
          </a>
        ))}

        {lyricItems.map((item) => (
          <a
            key={item.key}
            href={getDownloadUrl(jobId, item.filename)}
            download
            className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-300/[0.055] text-cyan-200">
              <DownloadIcon />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-200">{item.label}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">{item.detail}</p>
            </div>
            <span className="text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-slate-400" aria-hidden="true">→</span>
          </a>
        ))}
      </div>
    </section>
  );
}

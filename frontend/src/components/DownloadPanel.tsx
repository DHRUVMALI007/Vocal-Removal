"use client";

import { getDownloadUrl } from "@/lib/api";
import type { JobResultsResponse } from "@/lib/types";

interface DownloadPanelProps {
  jobId: string;
  results: JobResultsResponse;
}

export default function DownloadPanel({ jobId, results }: DownloadPanelProps) {
  const downloads = results.download_urls;

  const items = [
    ...results.stems.map((s) => ({
      key: s.name,
      label: s.label,
      url: getDownloadUrl(jobId, s.filename),
    })),
    { key: "lyrics_txt", label: "Lyrics (TXT)", url: downloads.lyrics_txt ? getDownloadUrl(jobId, "lyrics.txt") : null },
    { key: "lyrics_srt", label: "Lyrics (SRT)", url: downloads.lyrics_srt ? getDownloadUrl(jobId, "lyrics.srt") : null },
    { key: "lyrics_lrc", label: "Lyrics (LRC)", url: downloads.lyrics_lrc ? getDownloadUrl(jobId, "lyrics.lrc") : null },
    { key: "all_zip", label: "Download All (ZIP)", url: getDownloadUrl(jobId, "all.zip") },
  ].filter((i) => i.url);

  return (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Downloads</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.url!}
            download
            className="btn-secondary inline-flex items-center gap-2 text-sm hover:border-accent/50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

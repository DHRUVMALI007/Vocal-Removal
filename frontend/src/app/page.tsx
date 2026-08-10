"use client";

import { useState } from "react";
import UploadZone from "@/components/UploadZone";
import Workspace from "@/components/Workspace";
import { createJob, pollUntilComplete, startSeparation } from "@/lib/api";
import type { JobStatusResponse, SeparationOptions } from "@/lib/types";

type AppPhase = "upload" | "processing" | "workspace";

export default function HomePage() {
  const [phase, setPhase] = useState<AppPhase>("upload");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File, options: SeparationOptions) => {
    setError(null);
    setPhase("processing");

    try {
      const { job_id } = await createJob(file);
      setJobId(job_id);
      await startSeparation(job_id, options);
      const final = await pollUntilComplete(job_id, setProgress);

      if (final.status === "failed") {
        setError(final.error || "Processing failed");
        setPhase("upload");
        return;
      }

      setPhase("workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhase("upload");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-surface to-[#0a0a0f]">
      <header className="border-b border-surface-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-blue-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <span className="text-lg font-bold">Vocal Manager</span>
          </div>
          {phase === "workspace" && (
            <button
              type="button"
              onClick={() => {
                setPhase("upload");
                setJobId(null);
                setProgress(null);
              }}
              className="btn-secondary text-sm"
            >
              New Song
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {phase === "upload" && (
          <>
            <section className="mb-12 text-center">
              <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
                Turn any song into <span className="gradient-text">karaoke</span>
              </h1>
              <p className="mx-auto max-w-xl text-gray-400">
                AI-powered vocal removal, stem separation, and synchronized lyrics for singing practice.
                Separation quality varies by song — results are best-effort, not guaranteed perfect.
              </p>
            </section>
            <UploadZone onUpload={handleUpload} />
            {error && (
              <p className="mt-4 text-center text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
          </>
        )}

        {phase === "processing" && (
          <div className="flex flex-col items-center py-20">
            <div className="mb-6 h-12 w-12 animate-spin rounded-full border-3 border-accent border-t-transparent" />
            <h2 className="mb-2 text-xl font-semibold">Processing your track</h2>
            <p className="mb-4 text-gray-400">{progress?.message || "Starting..."}</p>
            <div className="w-full max-w-md">
              <div className="h-2 overflow-hidden rounded-full bg-surface-border">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-blue-500 transition-all duration-500"
                  style={{ width: `${progress?.progress ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-center text-sm text-gray-500">
                {Math.round(progress?.progress ?? 0)}%
                {progress?.step ? ` — ${progress.step}` : ""}
              </p>
            </div>
            {progress?.error && <p className="mt-4 text-red-400">{progress.error}</p>}
          </div>
        )}

        {phase === "workspace" && jobId && <Workspace jobId={jobId} />}
      </div>

      <footer className="mt-20 border-t border-surface-border py-6 text-center text-xs text-gray-600">
        Vocal Manager — AI stem separation & karaoke practice. No data stored permanently.
      </footer>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ProcessingExperience from "@/components/ProcessingExperience";
import UploadZone from "@/components/UploadZone";
import Workspace from "@/components/Workspace";
import { createJob, deleteJob, getJobStatus, pollUntilComplete, startSeparation } from "@/lib/api";
import type { JobStatusResponse, SeparationOptions } from "@/lib/types";

type Route =
  | { page: "home" }
  | { page: "studio"; jobId?: string }
  | { page: "about" }
  | { page: "not-found" };

type StudioPhase = "upload" | "starting" | "processing" | "workspace" | "failed";

function parseRoute(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return { page: "home" };
  if (clean === "/about") return { page: "about" };
  if (clean === "/studio") return { page: "studio" };
  const studioMatch = clean.match(/^\/studio\/([^/]+)$/);
  if (studioMatch) return { page: "studio", jobId: decodeURIComponent(studioMatch[1]) };
  return { page: "not-found" };
}

function useBrowserRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((path: string, replace = false) => {
    if (window.location.pathname !== path) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    }
    setPathname(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return { pathname, route: parseRoute(pathname), navigate };
}

interface NavLinkProps {
  href: string;
  active?: boolean;
  navigate: (path: string) => void;
  children: ReactNode;
  className?: string;
}

function NavLink({ href, active, navigate, children, className = "" }: NavLinkProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(href);
      }}
      className={`${className} ${
        active ? "text-white" : "text-slate-400 hover:text-white"
      } transition-colors`}
    >
      {children}
    </a>
  );
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span className="brand-bar brand-bar-1" />
      <span className="brand-bar brand-bar-2" />
      <span className="brand-bar brand-bar-3" />
      <span className="brand-bar brand-bar-4" />
    </div>
  );
}

function SiteHeader({ pathname, navigate }: { pathname: string; navigate: (path: string) => void }) {
  const inStudio = pathname.startsWith("/studio");
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#070910]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
        <NavLink href="/" navigate={navigate} className="flex items-center gap-3 text-white">
          <BrandMark />
          <span className="text-base font-bold tracking-tight sm:text-lg">Vocal Manager</span>
        </NavLink>

        <nav className="ml-auto flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.025] p-1 text-sm">
          <NavLink
            href="/"
            active={pathname === "/"}
            navigate={navigate}
            className={`rounded-full px-3 py-2 ${pathname === "/" ? "bg-white/[0.08]" : ""}`}
          >
            Home
          </NavLink>
          <NavLink
            href="/studio"
            active={inStudio}
            navigate={navigate}
            className={`rounded-full px-3 py-2 ${inStudio ? "bg-white/[0.08]" : ""}`}
          >
            Studio
          </NavLink>
          <NavLink
            href="/about"
            active={pathname === "/about"}
            navigate={navigate}
            className={`hidden rounded-full px-3 py-2 sm:block ${pathname === "/about" ? "bg-white/[0.08]" : ""}`}
          >
            About
          </NavLink>
        </nav>

        {!inStudio && (
          <button type="button" onClick={() => navigate("/studio")} className="btn-primary hidden sm:inline-flex">
            Open Studio
          </button>
        )}
      </div>
    </header>
  );
}

function SiteFooter({ navigate }: { navigate: (path: string) => void }) {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-[#05070d]/70">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <div className="mb-3 flex items-center gap-3 text-white">
            <BrandMark />
            <span className="font-semibold">Vocal Manager</span>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-500">
            AI-powered stem separation, synchronized lyrics, and karaoke practice in one focused music workspace.
            Processing files are temporary and are automatically cleaned up by the server.
          </p>
        </div>
        <div className="flex items-start gap-5 text-sm text-slate-500">
          <NavLink href="/" navigate={navigate}>Home</NavLink>
          <NavLink href="/studio" navigate={navigate}>Studio</NavLink>
          <NavLink href="/about" navigate={navigate}>About</NavLink>
        </div>
      </div>
    </footer>
  );
}

function HeroArtwork() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[490px]" aria-hidden="true">
      <div className="absolute inset-[7%] rounded-full bg-purple-500/[0.15] blur-3xl" />
      <div className="absolute inset-[15%] rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="record-shell absolute inset-[11%] flex items-center justify-center rounded-full border border-white/10 bg-[#0d1120]/[0.85] shadow-2xl">
        <div className="record-ring absolute inset-[8%] rounded-full border border-white/[0.055]" />
        <div className="record-ring absolute inset-[19%] rounded-full border border-white/[0.055]" />
        <div className="record-ring absolute inset-[30%] rounded-full border border-white/[0.055]" />
        <div className="relative flex h-[33%] w-[33%] items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-cyan-500 shadow-[0_0_70px_rgba(124,92,255,0.4)]">
          <svg className="h-14 w-14 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h5V3h-7Z" />
          </svg>
        </div>
      </div>
      <div className="absolute left-[4%] top-[20%] rounded-2xl border border-white/10 bg-[#101524]/90 px-4 py-3 shadow-xl backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">AI stems</p>
        <p className="mt-1 text-sm font-semibold text-white">Vocals · Drums · Bass</p>
      </div>
      <div className="absolute bottom-[13%] right-[2%] flex items-end gap-1.5 rounded-2xl border border-white/10 bg-[#101524]/90 px-4 py-3 shadow-xl backdrop-blur">
        {[13, 25, 18, 34, 22, 42, 29, 18, 35].map((height, index) => (
          <span
            key={index}
            className="eq-bar w-1.5 rounded-full bg-gradient-to-t from-violet-500 to-cyan-300"
            style={{ height, animationDelay: `${index * 0.09}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function LandingPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="music-grid absolute inset-0 opacity-35" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
          <div className="relative z-10">
            <div className="eyebrow mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.8)]" />
              AI MUSIC PRACTICE STUDIO
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              Hear every layer.
              <span className="gradient-text block">Own every note.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Remove vocals, split a song into clean stems, follow synchronized lyrics, and practice with a mixer built for musicians—not file converters.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate("/studio")} className="btn-primary btn-large">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7L8 5Z" />
                </svg>
                Start separating
              </button>
              <a href="#how-it-works" className="btn-secondary btn-large">
                See how it works
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-2"><span className="status-dot" /> MP3, WAV, FLAC, M4A, OGG, AAC</span>
              <span className="flex items-center gap-2"><span className="status-dot" /> No account required</span>
              <span className="flex items-center gap-2"><span className="status-dot" /> Temporary processing files</span>
            </div>
          </div>
          <HeroArtwork />
        </div>
      </section>

      <section className="border-y border-white/5 bg-white/[0.018]">
        <div className="mx-auto grid max-w-7xl divide-y divide-white/5 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
          {[
            ["01", "Separate", "AI isolates vocals and accompaniment with HTDemucs."],
            ["02", "Practice", "Mute, solo, slow down, seek, and loop the exact section you need."],
            ["03", "Export", "Download selected stems plus TXT, SRT, LRC, or one ZIP."],
          ].map(([number, title, text]) => (
            <div key={number} className="py-8 sm:px-7 sm:first:pl-0 sm:last:pr-0">
              <span className="font-mono text-xs text-violet-300">{number}</span>
              <h2 className="mt-3 text-xl font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
          <div>
            <div className="eyebrow mb-5">YOUR PRACTICE WORKFLOW</div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">A cleaner path from song to session.</h2>
            <p className="mt-5 text-sm leading-7 text-slate-500">
              Pick only the outputs you need. The studio handles the heavy processing, then opens a focused workspace for listening, lyric practice, and downloads.
            </p>
            <button type="button" onClick={() => navigate("/studio")} className="btn-secondary mt-7">
              Build a session
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Vocal removal", "Create an instrumental/karaoke track while keeping isolated vocals available for reference."],
              ["Stem mixer", "Control vocals, drums, bass, other, and instrumental channels with mute, solo, and volume."],
              ["Synced lyrics", "Whisper transcription gives timestamped lyric lines you can click to seek and loop."],
              ["Practice controls", "Switch between 0.5×, 0.75×, and 1× playback while keeping your place in the song."],
            ].map(([title, text], index) => (
              <article key={title} className="feature-card group">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] font-mono text-xs text-violet-300 transition group-hover:border-violet-400/30 group-hover:bg-violet-500/10">
                  0{index + 1}
                </div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
        <div className="overflow-hidden rounded-[2rem] border border-violet-400/[0.15] bg-gradient-to-br from-violet-500/[0.12] via-[#111526] to-cyan-400/5 p-8 shadow-2xl sm:p-12">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Ready when you are</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Bring a track. Leave with a practice session.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Choose the stems and lyrics you want before processing starts. No unnecessary outputs, no clutter.</p>
            </div>
            <button type="button" onClick={() => navigate("/studio")} className="btn-primary btn-large whitespace-nowrap">
              Open the studio
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function StudioPage({ routeJobId, navigate }: { routeJobId?: string; navigate: (path: string) => void }) {
  const [phase, setPhase] = useState<StudioPhase>(routeJobId ? "processing" : "upload");
  const [progress, setProgress] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);

  useEffect(() => {
    if (!routeJobId) {
      setPhase("upload");
      setProgress(null);
      setError(null);
      setSelectedTrack(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    const monitorJob = async () => {
      setError(null);
      setPhase("processing");
      try {
        const initial = await getJobStatus(routeJobId, controller.signal);
        if (!active) return;
        setProgress(initial);

        if (initial.status === "completed") {
          setPhase("workspace");
          return;
        }
        if (initial.status === "failed") {
          setError(initial.error || initial.message || "Processing failed");
          setPhase("failed");
          return;
        }

        const final = await pollUntilComplete(
          routeJobId,
          (status) => active && setProgress(status),
          1800,
          10 * 60 * 1000,
          controller.signal,
        );
        if (!active) return;
        if (final.status === "failed") {
          setError(final.error || final.message || "Processing failed");
          setPhase("failed");
        } else {
          setPhase("workspace");
        }
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load this studio session");
        setPhase("failed");
      }
    };

    void monitorJob();
    return () => {
      active = false;
      controller.abort();
    };
  }, [routeJobId]);

  const handleUpload = async (file: File, options: SeparationOptions) => {
    setError(null);
    setSelectedTrack(file.name);
    setProgress({
      job_id: "pending",
      status: "created",
      progress: 4,
      step: "upload",
      message: "Uploading your track",
      error: null,
    });
    setPhase("starting");

    try {
      const { job_id } = await createJob(file);
      setProgress({
        job_id,
        status: "queued",
        progress: 6,
        step: "upload",
        message: "Upload complete. Starting the AI pipeline",
        error: null,
      });
      await startSeparation(job_id, options);
      navigate(`/studio/${encodeURIComponent(job_id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhase("failed");
    }
  };

  const startOver = () => {
    if (routeJobId) void deleteJob(routeJobId).catch(() => undefined);
    navigate("/studio");
  };

  if (phase === "starting" || phase === "processing") {
    return <ProcessingExperience status={progress} trackName={selectedTrack} onStartOver={startOver} />;
  }

  if (phase === "workspace" && routeJobId) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Workspace jobId={routeJobId} onNewSong={startOver} />
      </section>
    );
  }

  if (phase === "failed") {
    return (
      <section className="mx-auto flex min-h-[68vh] max-w-7xl items-center px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-red-400/20 bg-red-400/[0.055] p-7 text-center shadow-2xl sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 9v4m0 4h.01M10.3 3.8 2.5 17.3A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.7L13.7 3.8a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Session stopped</p>
          <h1 className="mt-2 text-2xl font-bold text-white">We couldn’t finish this track.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">{error || "The processing job is no longer available."}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={startOver} className="btn-primary">Choose another track</button>
            <button type="button" onClick={() => navigate("/")} className="btn-secondary">Back home</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      <div className="music-grid absolute inset-0 opacity-25" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto mb-9 max-w-3xl text-center">
          <div className="eyebrow mx-auto mb-5 w-fit">CREATE A NEW SESSION</div>
          <h1 className="text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl">Build your practice mix.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Pick the outputs you actually want, add one song, and we’ll turn it into a playable stem-and-lyrics workspace.
          </p>
        </div>
        <UploadZone onUpload={handleUpload} />
      </div>
    </section>
  );
}

function AboutPage({ navigate }: { navigate: (path: string) => void }) {
  const cards = [
    ["What it does", "HTDemucs separates vocals, drums, bass, and other accompaniment. The app can also mix the accompaniment into an instrumental track."],
    ["How lyrics work", "When lyrics are selected, the isolated vocal stem is transcribed with faster-whisper and exported as timestamped lines plus TXT, SRT, and LRC files."],
    ["What to expect", "Source separation and transcription are best-effort AI processes. Dense mixes, backing vocals, live recordings, and heavy effects can reduce accuracy."],
    ["Your files", "This MVP has no user account or long-term library. Jobs live in temporary server storage and are removed automatically according to the server cleanup policy."],
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
        <div>
          <div className="eyebrow mb-5">ABOUT THE STUDIO</div>
          <h1 className="text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl">A practical AI tool for listening and practice.</h1>
          <p className="mt-6 text-base leading-7 text-slate-400">
            Vocal Manager is designed around the workflow after separation: hear individual parts, remove the lead vocal, follow the words, loop difficult sections, and export what you need.
          </p>
          <button type="button" onClick={() => navigate("/studio")} className="btn-primary btn-large mt-8">Try it with a song</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(([title, text]) => (
            <article key={title} className="feature-card min-h-52">
              <div className="mb-5 h-1 w-10 rounded-full bg-gradient-to-r from-violet-500 to-cyan-300" />
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">{text}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-16 rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-7 sm:p-9">
        <h2 className="text-xl font-semibold text-white">Current model scope</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Vocals", "Lead and backing vocal energy can share the same stem."],
            ["Drums", "Drum kit and percussion content."],
            ["Bass", "Bass-focused source stem."],
            ["Other", "Guitars, keys, strings, and remaining accompaniment."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/5 bg-black/[0.15] p-4">
              <p className="font-medium text-slate-200">{title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-600">Dedicated guitar, piano, tabla, or other instrument stems require a different/specialized separation model.</p>
      </div>
    </section>
  );
}

function NotFoundPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className="flex min-h-[68vh] items-center justify-center px-4 py-16 text-center">
      <div>
        <p className="font-mono text-sm text-violet-300">404 / OFF BEAT</p>
        <h1 className="mt-3 text-4xl font-bold text-white">That page isn’t in this mix.</h1>
        <p className="mt-3 text-sm text-slate-500">Head back to the studio and start a new session.</p>
        <button type="button" onClick={() => navigate("/studio")} className="btn-primary mt-7">Open Studio</button>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { pathname, route, navigate } = useBrowserRoute();

  const title = useMemo(() => {
    if (route.page === "studio") return "Studio — Vocal Manager";
    if (route.page === "about") return "About — Vocal Manager";
    if (route.page === "not-found") return "Page not found — Vocal Manager";
    return "Vocal Manager — AI Karaoke & Stem Separation";
  }, [route.page]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <SiteHeader pathname={pathname} navigate={navigate} />
      <main className="relative z-10 flex-1">
        {route.page === "home" && <LandingPage navigate={navigate} />}
        {route.page === "studio" && <StudioPage routeJobId={route.jobId} navigate={navigate} />}
        {route.page === "about" && <AboutPage navigate={navigate} />}
        {route.page === "not-found" && <NotFoundPage navigate={navigate} />}
      </main>
      <SiteFooter navigate={navigate} />
    </div>
  );
}

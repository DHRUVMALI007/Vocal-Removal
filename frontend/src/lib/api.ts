import type { JobResultsResponse, JobStatusResponse, SeparationOptions } from "./types";

export const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Cannot reach the server. Check that the backend is running and reachable.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = body.detail;
    if (response.status === 404) {
      throw new Error(typeof detail === "string" ? detail : "This temporary studio session is no longer available.");
    }
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  return response.json();
}

export async function createJob(
  file: File,
  onUploadProgress?: (percent: number) => void,
): Promise<{ job_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/jobs`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onUploadProgress?.(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };

    xhr.onerror = () => reject(new Error("Cannot reach the server. Check that the backend is running and reachable."));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
    xhr.onload = () => {
      const body = xhr.response ?? (() => {
        try {
          return JSON.parse(xhr.responseText || "{}");
        } catch {
          return {};
        }
      })();

      if (xhr.status >= 200 && xhr.status < 300) {
        onUploadProgress?.(100);
        resolve(body);
        return;
      }

      const detail = body?.detail;
      reject(new Error(typeof detail === "string" ? detail : `Upload failed (${xhr.status})`));
    };

    xhr.send(form);
  });
}

export async function startSeparation(jobId: string, options: SeparationOptions): Promise<JobStatusResponse> {
  return request(`/api/jobs/${jobId}/separate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
}

export async function getJobStatus(jobId: string, signal?: AbortSignal): Promise<JobStatusResponse> {
  return request(`/api/jobs/${jobId}/status`, { signal });
}

export async function getJobResults(jobId: string): Promise<JobResultsResponse> {
  return request(`/api/jobs/${jobId}/results`);
}

export function getDownloadUrl(jobId: string, filename: string): string {
  return `${API_URL}/api/jobs/${jobId}/download/${encodeURIComponent(filename)}`;
}

export function getStemAudioUrl(jobId: string, filename: string): string {
  return getDownloadUrl(jobId, filename);
}

export async function deleteJob(jobId: string): Promise<void> {
  await request(`/api/jobs/${jobId}`, { method: "DELETE" });
}

export async function pollUntilComplete(
  jobId: string,
  onProgress?: (status: JobStatusResponse) => void,
  intervalMs = 2000,
  timeoutMs = 10 * 60 * 1000,
  signal?: AbortSignal,
): Promise<JobStatusResponse> {
  const startedAt = Date.now();

  while (true) {
    if (signal?.aborted) throw new DOMException("Polling aborted", "AbortError");
    const status = await getJobStatus(jobId, signal);
    onProgress?.(status);
    if (status.status === "completed" || status.status === "failed") return status;
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Processing timed out. Check the backend logs and try the track again.");
    }
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        window.clearTimeout(timer);
        reject(new DOMException("Polling aborted", "AbortError"));
      };
      const timer = window.setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, intervalMs);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

import type { JobResultsResponse, JobStatusResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function createJob(file: File): Promise<{ job_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  return request("/api/jobs", { method: "POST", body: form });
}

export async function startSeparation(jobId: string): Promise<JobStatusResponse> {
  return request(`/api/jobs/${jobId}/separate`, { method: "POST" });
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return request(`/api/jobs/${jobId}/status`);
}

export async function getJobResults(jobId: string): Promise<JobResultsResponse> {
  return request(`/api/jobs/${jobId}/results`);
}

export function getDownloadUrl(jobId: string, filename: string): string {
  return `${API_URL}/api/jobs/${jobId}/download/${filename}`;
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
): Promise<JobStatusResponse> {
  while (true) {
    const status = await getJobStatus(jobId);
    onProgress?.(status);
    if (status.status === "completed" || status.status === "failed") {
      return status;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

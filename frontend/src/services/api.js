const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error("Cannot reach server. Is the backend running?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = body.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${res.status})`);
  }
  return res.json();
}

export async function createJob(file, onUploadProgress) {
  const form = new FormData();
  form.append("file", file);
  onUploadProgress?.("Uploading");

  const res = await fetch(`${API_URL}/api/jobs`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || "Upload failed");
  }
  return res.json();
}

export async function startSeparation(jobId) {
  return request(`/api/jobs/${jobId}/separate`, { method: "POST" });
}

export async function getJobStatus(jobId) {
  return request(`/api/jobs/${jobId}/status`);
}

export async function getJobResults(jobId) {
  return request(`/api/jobs/${jobId}/results`);
}

export function getDownloadUrl(jobId, filename) {
  return `${API_URL}/api/jobs/${jobId}/download/${filename}`;
}

export async function deleteJob(jobId) {
  await request(`/api/jobs/${jobId}`, { method: "DELETE" });
}

export async function pollUntilComplete(jobId, onProgress, intervalMs = 2000) {
  for (;;) {
    const status = await getJobStatus(jobId);
    onProgress?.(status);
    if (status.status === "completed" || status.status === "failed") return status;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export { API_URL };

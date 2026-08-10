import { useCallback, useState } from "react";
import { createJob, getJobResults, pollUntilComplete, startSeparation } from "../services/api";

export function useJob() {
  const [phase, setPhase] = useState("upload");
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const reset = useCallback(() => {
    setPhase("upload");
    setJobId(null);
    setStatus(null);
    setResults(null);
    setError(null);
    setSelectedFile(null);
  }, []);

  const uploadAndProcess = useCallback(async (file) => {
    setError(null);
    setSelectedFile({ name: file.name, size: file.size });
    setPhase("processing");

    try {
      const { job_id } = await createJob(file, () => setStatus({ step: "upload", message: "Uploading" }));
      setJobId(job_id);
      await startSeparation(job_id);
      const final = await pollUntilComplete(job_id, setStatus);

      if (final.status === "failed") {
        throw new Error(final.error || final.message || "Processing failed");
      }

      const res = await getJobResults(job_id);
      setResults(res);
      setPhase("workspace");
    } catch (err) {
      setError(err.message || "Something went wrong");
      setPhase("upload");
    }
  }, []);

  return {
    phase,
    jobId,
    status,
    results,
    error,
    selectedFile,
    uploadAndProcess,
    reset,
    setError,
  };
}

import { getStageLabel } from "../utils/formatTime";

export default function ProcessingStatus({ status }) {
  const label = getStageLabel(status || {});
  const failed = status?.status === "failed";

  return (
    <div className="mx-auto w-full max-w-lg py-16 text-center" role="status" aria-live="polite">
      {!failed && (
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      )}
      <h2 className="mb-2 text-xl font-semibold">{failed ? "Failed" : label}</h2>
      <p className="text-gray-400">{status?.message || "Please wait..."}</p>
      {!failed && status?.progress > 0 && (
        <p className="mt-2 text-sm text-gray-500">{Math.round(status.progress)}%</p>
      )}
      {failed && status?.error && (
        <p className="mt-4 text-sm text-red-400">{status.error}</p>
      )}
    </div>
  );
}

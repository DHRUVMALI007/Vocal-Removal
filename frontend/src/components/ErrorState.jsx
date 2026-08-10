export default function ErrorState({ message, onRetry }) {
  return (
    <div className="card mx-auto max-w-lg border-red-500/30 bg-red-500/5 text-center" role="alert">
      <p className="mb-1 font-medium text-red-400">Something went wrong</p>
      <p className="mb-4 text-sm text-gray-400">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary text-red-300">
          Try again
        </button>
      )}
    </div>
  );
}

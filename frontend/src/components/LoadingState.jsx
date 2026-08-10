export default function LoadingState({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <p className="text-gray-400">{message}</p>
    </div>
  );
}

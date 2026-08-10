import { formatTime } from "../utils/formatTime";
import { useLyricsSync } from "../hooks/useLyricsSync";

export default function LyricsPanel({ lines, currentTime, onSeek, onSetLoop }) {
  const { activeIndex, activeRef } = useLyricsSync(lines, currentTime);
  const loopStartRef = { current: null };

  if (!lines?.length) {
    return (
      <div className="card">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">Lyrics</h3>
        <p className="text-sm text-gray-500">No lyrics available. Transcription may have found no vocals or failed.</p>
      </div>
    );
  }

  const handleClick = (line, index) => {
    if (loopStartRef.current === null) {
      loopStartRef.current = line.start;
    } else {
      const start = loopStartRef.current;
      onSetLoop(start < line.end ? { start, end: line.end } : { start: line.end, end: start });
      loopStartRef.current = null;
    }
    onSeek(line.start);
  };

  return (
    <div className="card flex max-h-[420px] flex-col">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Lyrics</h3>
      <p className="mb-2 text-xs text-gray-500">Click to seek. Click two lines to loop a section.</p>
      <div className="flex-1 overflow-y-auto pr-1">
        {lines.map((line, i) => (
          <button
            key={`${line.start}-${i}`}
            type="button"
            ref={i === activeIndex ? activeRef : undefined}
            onClick={() => handleClick(line, i)}
            className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-base transition ${
              i === activeIndex
                ? "bg-gradient-to-r from-accent/30 to-blue-500/20 font-semibold text-white"
                : "text-gray-400 hover:bg-surface-elevated hover:text-gray-200"
            }`}
          >
            <span className="mr-2 text-xs text-gray-600">{formatTime(line.start)}</span>
            {line.text}
          </button>
        ))}
      </div>
    </div>
  );
}

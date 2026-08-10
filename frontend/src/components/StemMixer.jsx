import StemChannel from "./StemChannel";

export default function StemMixer({ channels, onChange, onPreset }) {
  const update = (name, patch) => {
    onChange(channels.map((c) => (c.name === name ? { ...c, ...patch } : c)));
  };

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Stem Mixer</h3>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => onPreset("muteAll")}>Mute All</button>
          <button type="button" className="btn-secondary text-xs" onClick={() => onPreset("reset")}>Reset Mixer</button>
          <button type="button" className="btn-secondary text-xs" onClick={() => onPreset("instrumental")}>Instrumental Only</button>
          <button type="button" className="btn-secondary text-xs" onClick={() => onPreset("original")}>Original Mix</button>
        </div>
      </div>

      <div className="space-y-2">
        {channels.map((ch) => (
          <StemChannel key={ch.name} channel={ch} onChange={(patch) => update(ch.name, patch)} />
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        HTDemucs stems only. No fake guitar/tabla/piano channels.
      </p>
    </div>
  );
}

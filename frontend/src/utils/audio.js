export const STEM_COLORS = {
  original: "#94a3b8",
  vocals: "#ec4899",
  instrumental: "#8b5cf6",
  drums: "#f97316",
  bass: "#3b82f6",
  other: "#14b8a6",
};

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1];

export function getEffectiveGain(channel, allChannels) {
  const anySolo = allChannels.some((c) => c.solo);
  if (anySolo && !channel.solo) return 0;
  if (channel.muted) return 0;
  return channel.volume;
}

export function buildChannelsFromResults(results, jobId, getDownloadUrl) {
  if (!results?.stems) return [];
  return results.stems
    .filter((s) => s.available !== false)
    .map((s) => ({
      name: s.name,
      label: s.label,
      filename: s.filename,
      url: getDownloadUrl(jobId, s.filename),
      muted: s.name === "original" || s.name === "vocals",
      solo: false,
      volume: 1,
    }));
}

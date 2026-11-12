// How a reader keeps their place: each series its own way ("series", the
// default), every series by chapters or by volumes, or both side by side.
// The same rule as the server's (util/releases/releaseStatus.ts tracksOf).
export type TrackBy = "series" | "chapters" | "volumes" | "both";

export const readTrackBy = (value: unknown): TrackBy =>
  value === "chapters" || value === "volumes" || value === "both"
    ? value
    : "series";

export const tracksOf = (m: { byVolume?: boolean }, mode: TrackBy) => ({
  chapters:
    mode === "chapters" ||
    mode === "both" ||
    (mode === "series" && !m.byVolume),
  volumes:
    mode === "volumes" ||
    mode === "both" ||
    (mode === "series" && Boolean(m.byVolume)),
});

// where they are, as a card says it: "ch. 40", "vol. 5", or both
export const placeText = (
  m: {
    byVolume?: boolean;
    bookmark: number | null;
    readVolume?: number | null;
  },
  mode: TrackBy,
) => {
  const tracks = tracksOf(m, mode);
  const parts = [
    tracks.chapters && m.bookmark ? `ch. ${m.bookmark}` : null,
    tracks.volumes && m.readVolume ? `vol. ${m.readVolume}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

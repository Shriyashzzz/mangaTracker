// How a reader keeps their place: each series its own way ("series", the
// default), every series by chapters or by volumes, or both side by side.
// The same rule as the server's (util/releases/releaseStatus.ts tracksOf).
export type TrackBy = "series" | "chapters" | "volumes" | "both";

export const readTrackBy = (value: unknown): TrackBy =>
  value === "chapters" || value === "volumes" || value === "both"
    ? value
    : "series";

// which counters a series shows. One setting for every series wins; left on
// "series", each series follows its own switch. The same rule as the
// server's (server/src/util/releases/releaseStatus.ts tracksOf): change both
// together (server tests/shelf/rulesInStep.test.ts fails if they differ)
export const tracksOf = (m: { byVolume?: boolean }, mode: TrackBy) => {
  if (mode === "both") return { chapters: true, volumes: true };
  if (mode === "chapters") return { chapters: true, volumes: false };
  if (mode === "volumes") return { chapters: false, volumes: true };
  const byVolume = Boolean(m.byVolume);
  return { chapters: !byVolume, volumes: byVolume };
};

// where they are, as a card says it: "ch. 40", "vol. 5", or both
export const placeText = (
  m: {
    byVolume?: boolean;
    bookmark: number | null;
    readVolume?: number | null;
    // the edition they collect: the volume is then said as its book
    editionPlace?: { label: string; read: number | null } | null;
  },
  mode: TrackBy,
  // "read vol. 5": where the volumes owned sit beside it as "Vol. 1–7" (a
  // shared shelf), a bare "vol. 5" would read as one more of those
  saysRead = false,
) => {
  const tracks = tracksOf(m, mode);
  const parts: string[] = [];
  if (tracks.chapters && m.bookmark) parts.push(`ch. ${m.bookmark}`);
  if (tracks.volumes && m.readVolume) {
    // "VIZBIG 4" for someone collecting VIZBIG; "vol. 12" otherwise, and
    // for a volume their edition has no book for
    const book = m.editionPlace?.read;
    const volume = book
      ? `${m.editionPlace!.label} ${book}`
      : `vol. ${m.readVolume}`;
    parts.push(saysRead ? `read ${volume}` : volume);
  }
  return parts.length ? parts.join(" · ") : null;
};

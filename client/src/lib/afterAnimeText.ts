// The words for one season on an "after the anime" page: what to start at,
// where the season stops, which volumes to get. Pure rules with no fetching,
// so the server's tests can run them (tests/prices/afterAnimeText.test.ts).

// one season (or film, or OVA) and where it leaves the manga. The server's
// SentStop
export type AnimeStop = {
  // "Season 2", "Reze Movie", or "The anime"
  label: string;
  endVolume: number | null;
  endChapter: number | null;
  // it stops partway through endChapter
  endsMidChapter: boolean;
  // the first chapter to read after it, and its volume when that's known
  nextChapter: number | null;
  nextVolume: number | null;
  // what else MangaUpdates says: "Skips Chap 80-81"
  note: string;
  // a reader's accepted correction is in it
  corrected: boolean;
  // it adapts the manga to its last chapter
  coversAll: boolean;
};

// "After Season 2", "After the anime"
export function afterLabel(stop: AnimeStop) {
  if (stop.label === "The anime") return "After the anime";
  return `After ${stop.label}`;
}

// the answer itself, said big
export function startText(stop: AnimeStop) {
  if (stop.coversAll) return "Nothing left to read";
  if (stop.nextChapter !== null) return `Start at chapter ${stop.nextChapter}`;
  if (stop.nextVolume !== null) return `Start with volume ${stop.nextVolume}`;
  if (stop.endVolume !== null) return `Pick up around volume ${stop.endVolume}`;
  return "We're not sure yet";
}

const inVolume = (volume: number | null) =>
  volume === null ? "" : `, in volume ${volume}`;

// where the season stops, as one sentence
export function endText(stop: AnimeStop) {
  const season = stop.label === "The anime" ? "The anime" : stop.label;
  if (stop.coversAll)
    return `${season} adapts the manga through its last chapter, ${stop.endChapter}.`;
  if (stop.endChapter === null) {
    if (stop.endVolume !== null)
      return `${season} ends in volume ${stop.endVolume}.`;
    // a correction that only names the volume to start from
    return "";
  }
  if (stop.endsMidChapter)
    return `${season} stops partway through chapter ${stop.endChapter}${inVolume(stop.endVolume)}.`;
  return `${season} ends at chapter ${stop.endChapter}${inVolume(stop.endVolume)}.`;
}

// a volume worth buying to carry on, and why it's that one
export type VolumeToGet = { volume: number; why: string };

// the volume the next chapter is in, when that's known. When only the
// anime's last volume is, that one and the one after: the next chapter is in
// one of the two
export function volumesToGet(stop: AnimeStop): VolumeToGet[] {
  if (stop.coversAll) return [];
  if (stop.nextVolume !== null) {
    const why =
      stop.nextChapter === null
        ? "Start here"
        : `Chapter ${stop.nextChapter} is in this one`;
    return [{ volume: stop.nextVolume, why }];
  }
  if (stop.endVolume === null) return [];
  return [
    { volume: stop.endVolume, why: "The anime ends in this one" },
    { volume: stop.endVolume + 1, why: "The one after" },
  ];
}

// said under two volumes, so it's clear why there are two
export function twoVolumesNote(stop: AnimeStop) {
  if (stop.nextVolume !== null || stop.endVolume === null || stop.coversAll)
    return "";
  const chapter =
    stop.nextChapter === null
      ? "The next chapter"
      : `Chapter ${stop.nextChapter}`;
  return `${chapter} is in volume ${stop.endVolume} or ${stop.endVolume + 1}: it depends on whether the anime ended partway through a volume.`;
}

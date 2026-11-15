// Which volume a chapter is in, and the other way round, for the "(vol. 5)"
// beside the chapter on a series' page. From MangaDex's list of where each
// volume starts, which the server sends with a series' release data
// (server util/releases/volumeStarts.ts).
//
// Only what the list is sure of: a chapter is placed only between two known
// starts, so the newest chapters, not in a book yet, and chapters in a hole
// of the list (Frieren's stops at vol. 1) get nothing. Pure, so the server's
// tests can load it.

export type VolumeStart = { volume: number; firstChapter: number };

// the volume that holds this chapter, or null when the list can't say
export function volumeHolding(
  chapter: number,
  starts: VolumeStart[],
): number | null {
  if (!(chapter > 0)) return null;
  for (let i = 0; i < starts.length - 1; i++) {
    const here = starts[i]!;
    const next = starts[i + 1]!;
    // the next volume in the list is the very next one, so this one ends
    // just before it
    if (next.volume !== here.volume + 1) continue;
    if (chapter >= here.firstChapter && chapter < next.firstChapter)
      return here.volume;
  }
  return null;
}

// the last chapter in this volume, or null when the list can't say
export function lastChapterOf(
  volume: number,
  starts: VolumeStart[],
): number | null {
  const here = starts.find((s) => s.volume === volume);
  const next = starts.find((s) => s.volume === volume + 1);
  if (!here || !next || next.firstChapter <= here.firstChapter) return null;
  return Math.ceil(next.firstChapter) - 1;
}

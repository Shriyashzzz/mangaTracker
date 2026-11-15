// Which volume a chapter is in, for the red mark on a series' volume shelf
// ("reading vol. 12"). From MangaDex's list of where each
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

// Where they are, as the volume shelf on a series' page marks it: the
// volume they've read up to, for someone keeping their place by the volume;
// else the volume their chapter is in, when the list is sure of it
export function placeOnShelf(
  manga: { bookmark: number | null; readVolume?: number | null },
  tracks: { chapters: boolean; volumes: boolean },
  starts: VolumeStart[],
): { volume: number; kind: "reading" | "read up to" } | null {
  if (tracks.volumes && manga.readVolume)
    return { volume: manga.readVolume, kind: "read up to" };
  if (!tracks.chapters || !manga.bookmark) return null;
  const volume = volumeHolding(manga.bookmark, starts);
  return volume ? { volume, kind: "reading" } : null;
}

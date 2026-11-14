// Which volume a chapter is in, from MangaDex's list of chapters per volume.
// That list has mistakes (Chainsaw Man's vol. 1 includes chapter 232), so each
// volume is placed by its lowest chapter, and any that would start before the
// volume ahead of it are dropped.

export type VolumeStart = { volume: number; firstChapter: number };

type AggregateVolumes = Record<string, { chapters?: Record<string, unknown> }>;

export function volumeStartsFrom(volumes: AggregateVolumes): VolumeStart[] {
  const starts: VolumeStart[] = [];
  const numbered = Object.entries(volumes)
    .map(([key, value]) => ({
      volume: parseFloat(key),
      chapters: Object.keys(value.chapters ?? {})
        .map(parseFloat)
        .filter(Number.isFinite),
    }))
    .filter((v) => Number.isFinite(v.volume) && v.chapters.length > 0)
    .sort((a, b) => a.volume - b.volume);

  for (const { volume, chapters } of numbered) {
    const firstChapter = Math.min(...chapters);
    const last = starts[starts.length - 1];
    if (!last || firstChapter > last.firstChapter) {
      starts.push({ volume, firstChapter });
    }
  }
  return starts;
}

// a volume doesn't hold more chapters than this: a chapter further than
// that past the last volume we know the start of is in a volume we don't
const MOST_CHAPTERS_IN_A_VOLUME = 15;

// The volume a chapter is in. A little past the last known start counts as
// that volume (the newest chapters aren't in a book yet). Far past it we
// can't say: MangaDex's list stops early for a licensed series (Frieren's
// ends at vol. 1), and chapter 60 isn't in volume 1
export function volumeOfChapter(
  chapter: number | null,
  starts: VolumeStart[],
): number | null {
  if (!chapter || chapter <= 0) return null;
  let found: VolumeStart | null = null;
  for (const start of starts) {
    if (start.firstChapter > chapter) break;
    found = start;
  }
  if (!found) return null;
  const isLastKnown = found === starts[starts.length - 1];
  const isFarPast =
    isLastKnown && chapter - found.firstChapter > MOST_CHAPTERS_IN_A_VOLUME;
  return isFarPast ? null : found.volume;
}

// A reader's accepted correction, laid over what MangaUpdates says: it
// replaces the season with the same name, or adds the season when the line
// had none by that name (so a series MangaUpdates knows nothing about can
// still get an answer). Pure rules; saving and reviewing is fixStore.ts.
import type { AnimeStop } from "./animeLines.js";

// a correction, as much of it as changes the answer
export type AcceptedFix = {
  label: string;
  // the last chapter the season adapts
  chapter: number | null;
  // the volume to start from
  volume: number | null;
};

// a season as the page shows it: `corrected` when a reader's fix is in it
export type ShownStop = AnimeStop & { corrected: boolean };

const sameSeason = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// one fix over the season it's about (or over nothing, for a new season)
function corrected(stop: AnimeStop | null, fix: AcceptedFix): ShownStop {
  const chapterGiven = fix.chapter !== null;
  // a new last chapter moves where the volumes were; only a volume the fix
  // names is still known
  const endVolume = chapterGiven ? null : (stop?.endVolume ?? null);
  const nextVolumeBefore = chapterGiven ? null : (stop?.nextVolume ?? null);
  return {
    label: stop?.label ?? fix.label.trim(),
    endVolume,
    endChapter: chapterGiven ? fix.chapter : (stop?.endChapter ?? null),
    endsMidChapter: chapterGiven ? false : (stop?.endsMidChapter ?? false),
    nextChapter: chapterGiven
      ? Math.floor(fix.chapter!) + 1
      : (stop?.nextChapter ?? null),
    nextVolume: fix.volume ?? nextVolumeBefore,
    // what MangaUpdates remarks on stays; a reader's own note is for whoever
    // reviews the fix, and isn't published
    note: stop?.note ?? "",
    corrected: true,
  };
}

// `fixes` oldest first, so the newest accepted one for a season wins
export function withFixes(
  stops: AnimeStop[],
  fixes: AcceptedFix[],
): ShownStop[] {
  const shown: ShownStop[] = stops.map((stop) => ({
    ...stop,
    corrected: false,
  }));
  for (const fix of fixes) {
    const at = shown.findIndex((stop) => sameSeason(stop.label, fix.label));
    if (at === -1) shown.push(corrected(null, fix));
    else shown[at] = corrected(shown[at]!, fix);
  }
  return shown;
}

// What a shelf card says in words and numbers, worked out from the series:
// the line under its name and the progress on a row's right side. Pure, so
// the card itself only draws.
import { rangesText } from "../../lib/ownedVolumes";
import type { Manga } from "../../lib/types";

// "own vols. 1–10": a collector of the books, no chapter kept. What they own
// says where they are, never "not started"
// For someone collecting an edition, in its books: "own VIZBIG 1–4"
export function ownedTextOf(
  owned: number[],
  edition?: { label: string; owned: number[] | null } | null,
) {
  if (!owned.length) return null;
  if (edition?.owned?.length)
    return `own ${edition.label} ${rangesText(edition.owned)}`;
  const word = owned.length === 1 ? "vol." : "vols.";
  return `own ${word} ${rangesText(owned)}`;
}

// a genre worth showing ("unlabled" is how an unset one was once saved)
export const genreOf = (manga: Manga) =>
  manga.genre && manga.genre !== "unlabled" ? manga.genre : null;

// a cover card's one line: their place ("ch. 38", or "vol. 5" for one read
// by the volume), else what they own ("own vols. 1–10"), or "to read" for
// one they haven't started, after "light novel" for one. The name and the
// stars say the rest, and the line keeps its room so cards line up
export function coverLine(
  manga: Manga,
  placeText: string | null,
  ownedText: string | null = null,
) {
  // "not started" as the row says it: never begun, nothing owned, not
  // finished (a collector's books say where they are on the row)
  const notStarted = !placeText && !ownedText && !manga.status;
  const place = manga.planned
    ? "to read"
    : (placeText ?? ownedText ?? (notStarted ? "not started" : null));
  const parts = [manga.lightNovel && "light novel", place];
  return parts.filter(Boolean).join(" · ");
}

// a row's second line: what it is
export function rowKindLine(manga: Manga) {
  const parts = [manga.lightNovel && "light novel", genreOf(manga)];
  return parts.filter(Boolean).join(" · ");
}

// how far through they are, for a row's bar: chapters when they count them,
// else volumes read
export function progressOf(
  manga: Manga,
  tracks: { chapters: boolean; volumes: boolean },
  latestChapter: number | null | undefined,
  latestVolume: number | null | undefined,
) {
  const byChapter = tracks.chapters && Boolean(manga.bookmark);
  let reading = 0;
  if (byChapter) reading = manga.bookmark ?? 0;
  else if (tracks.volumes) reading = manga.readVolume ?? 0;
  const latest = byChapter ? latestChapter : latestVolume;
  // a count that's behind where they are says nothing, so it isn't shown
  const knownTotal = latest != null && latest >= reading ? latest : null;
  const unit = byChapter ? ("ch." as const) : ("vol." as const);
  return { byChapter, unit, reading, knownTotal };
}

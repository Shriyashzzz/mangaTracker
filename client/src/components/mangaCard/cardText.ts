// What a shelf card says in words and numbers, worked out from the series:
// the line under its name and the progress on a row's right side. Pure, so
// the card itself only draws.
import { rangesText } from "../../lib/ownedVolumes";
import type { Manga } from "../../lib/types";

// "own vols. 1–10": a collector of the books, no chapter kept. What they own
// says where they are, never "not started"
export function ownedTextOf(owned: number[]) {
  if (!owned.length) return null;
  const word = owned.length === 1 ? "vol." : "vols.";
  return `own ${word} ${rangesText(owned)}`;
}

// a genre worth showing ("unlabled" is how an unset one was once saved)
export const genreOf = (manga: Manga) =>
  manga.genre && manga.genre !== "unlabled" ? manga.genre : null;

// a row's own line for their place: it's what they came to see. "Finished"
// isn't said here: the row's right side already says it
export function rowPlaceLine(
  manga: Manga,
  placeText: string | null,
  ownedText: string | null,
) {
  if (manga.planned) return "to read";
  if (placeText) return placeText;
  if (ownedText) return ownedText;
  return manga.status ? "no chapter saved" : "not started";
}

// a cover card's one line: where they are, then what it is. A blank or zero
// chapter says nothing worth showing
export function coverLine(
  manga: Manga,
  placeText: string | null,
  ownedText: string | null,
) {
  let place: string | null = placeText ?? ownedText;
  if (manga.status) place = "finished";
  else if (manga.planned) place = "to read";
  const parts = [place, manga.lightNovel && "light novel", genreOf(manga)];
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
  return { byChapter, reading, knownTotal };
}

// One manga from a MyAnimeList export, as a shelf entry. AniList is asked about
// it by its MyAnimeList id, which is exact, for the English title, cover and genre.
import { shelfKey, titleKey } from "./titleKey.js";
import { ownedVolumes } from "./ownedList.js";

const MAX_TITLE = 150;
const MAX_NOTES = 450;

export type MalEntry = {
  malId?: number;
  title: string;
  finished: boolean;
  chapters: number;
  readVolumes: number;
  // what MyAnimeList calls retail volumes: the ones they own
  ownedVolumes: number;
  score: number; // out of 10
  comments?: string;
  // from a plan to read or to-read list: goes on their To read list
  planned?: boolean;
  // AniList's cover, from a book app import matched by name
  cover?: string;
  // the import already knows it's a light novel (AniList, Kitsu, book apps)
  lightNovel?: boolean;
  // exactly which volumes they own, when a book app's export says
  ownedList?: number[];
  // other names it goes by: on the shelf under any of them, it's there
  otherNames?: string[];
  // from Manga Tracker's own export: a series already on the shelf also
  // takes what it lacks (backupFill)
  restore?: boolean;
  // from a backup: this series keeps its place by the volume
  byVolume?: boolean;
  // a backup's own genre, kept over AniList's (it may be hand-set)
  genre?: string;
};

// what a backup gives a series already on the shelf: only what the shelf
// lacks or is behind on, so an old backup never undoes newer reading. The
// further chapter, finished if the backup says so, a rating and notes where
// there are none
export function backupFill(
  entry: MalEntry,
  had: {
    bookmark: number | null;
    readVolume?: number | null;
    status: boolean;
    planned: boolean;
    rating: number | null;
    description: string | null;
  },
) {
  const rating = Math.round(entry.score / 2) || null;
  const notes = entry.comments?.trim().slice(0, MAX_NOTES) || null;
  const fill = {
    // a chapter saved means it's started: off To read
    ...(entry.chapters > (had.bookmark ?? 0)
      ? { bookmark: entry.chapters, ...(had.planned ? { planned: false } : {}) }
      : {}),
    ...(entry.readVolumes > (had.readVolume ?? 0)
      ? { readVolume: entry.readVolumes }
      : {}),
    ...(entry.finished && !had.status ? { status: true, planned: false } : {}),
    ...(rating && !had.rating ? { rating } : {}),
    ...(notes && !had.description?.trim() ? { description: notes } : {}),
  };
  return Object.keys(fill).length ? fill : null;
}

export type MalListing = {
  name: string;
  altNames: string[];
  cover: string | null;
  genre: string | null;
  lightNovel: boolean;
  // a finished series' last chapter, from AniList; null while it's coming out
  latestChapter: number | null;
};

export function toMangaInput(entry: MalEntry, listing: MalListing | null) {
  const name =
    listing?.name && listing.name.length <= MAX_TITLE
      ? listing.name
      : entry.title;
  return {
    name,
    genre: (entry.restore && entry.genre?.trim()) || listing?.genre || null,
    image: listing?.cover ?? entry.cover ?? null,
    description: entry.comments?.trim().slice(0, MAX_NOTES) || null,
    status: entry.finished && !entry.planned,
    planned: Boolean(entry.planned),
    lightNovel: entryIsLightNovel(entry, listing),
    bookmark: entry.planned ? null : entry.chapters,
    // a light novel is read by the volume unless the backup says otherwise
    byVolume: entry.byVolume ?? entryIsLightNovel(entry, listing),
    readVolume: entry.planned ? null : entry.readVolumes || null,
    // most people never fill in retail, so volumes read is the best guess left
    ...ownedVolumes(
      // (a backup's read volume is only that: it says what's owned itself)
      entry.ownedVolumes || (entry.restore ? 0 : entry.readVolumes) || null,
      entry.ownedList,
    ),
    rating: Math.round(entry.score / 2) || null,
    latestChapter: listing?.latestChapter ?? null,
  };
}

// what the import says, or else what AniList says
export const entryIsLightNovel = (
  entry: MalEntry,
  listing: MalListing | null,
) => entry.lightNovel ?? listing?.lightNovel ?? false;

// every name it could already be on the shelf under
export const namesOf = (entry: MalEntry, listing: MalListing | null) =>
  [
    entry.title,
    ...(entry.otherNames ?? []),
    listing?.name,
    ...(listing?.altNames ?? []),
  ]
    .filter((name): name is string => Boolean(name))
    .map(titleKey)
    .filter(Boolean);

export { shelfKey };

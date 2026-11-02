// One manga from a MyAnimeList export, as a shelf entry. AniList is asked about
// it by its MyAnimeList id, which is exact, for the English title, cover and genre.
import { slugify } from "../prices/match.js";

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
};

export type MalListing = {
  name: string;
  altNames: string[];
  cover: string | null;
  genre: string | null;
};

const MAX_TITLE = 150;
const MAX_NOTES = 450;

export function toMangaInput(entry: MalEntry, listing: MalListing | null) {
  const name =
    listing?.name && listing.name.length <= MAX_TITLE ? listing.name : entry.title;
  return {
    name,
    genre: listing?.genre ?? null,
    image: listing?.cover ?? null,
    description: entry.comments?.trim().slice(0, MAX_NOTES) || null,
    status: entry.finished,
    bookmark: entry.chapters,
    // most people never fill in retail, so volumes read is the best guess left
    volumesOwned: entry.ownedVolumes || entry.readVolumes || null,
    rating: Math.round(entry.score / 2) || null,
  };
}

// every name it could already be on the shelf under
export const namesOf = (entry: MalEntry, listing: MalListing | null) =>
  [entry.title, listing?.name, ...(listing?.altNames ?? [])]
    .filter((name): name is string => Boolean(name))
    .map(slugify)
    .filter(Boolean);

// The title to save for a new manga: AniList's, when AniList really lists what
// they typed, otherwise exactly what they typed. AniList's search is fuzzy and
// answers with its closest guess, so "solo" could come back as another series
// entirely; only the same title under any of its names counts.

//compares the written title against anilist title, without selecitng the dropdown prompt.
import { slugify } from "../../prices/stores/match.js";

type Listing = { name: string; altNames: string[] };

const MAX_TITLE = 150; // the same limit the add form has

export function canonicalTitle(typed: string, listing: Listing | null) {
  if (!listing?.name || listing.name.length > MAX_TITLE) return typed;
  const wanted = slugify(typed);
  if (!wanted) return typed;
  const isListed = [listing.name, ...listing.altNames].some(
    (name) => slugify(name) === wanted,
  );
  return isListed ? listing.name : typed;
}

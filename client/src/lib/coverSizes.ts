// One cover, at the widths it can be had at. The server resizes covers to
// a short list of widths and sends them as WebP (server
// prices/sources/coverResizer.ts): a page says how wide the cover is drawn
// (`sizes`), the browser is offered every width (`srcSet`), and the browser
// picks, since it knows the screen (a phone needs three times the pixels of
// the width drawn).
//
// Where a cover comes from decides which of our routes resizes it:
//
//   a volume's own cover      /api/prices/cover/<isbn>?w=330
//                             (the server finds it once, on Open Library
//                             or Google Books)
//   a series' cover           /api/prices/cover/series?name=<the series>
//                             &u=<its AniList cover>&w=330
//   anything else             shown as it is, at its one size
//
// A series' cover is asked for by the series' name, and the server sends
// the English one (its first US volume's) where it knows it, and AniList's
// Japanese one otherwise. That is the order everywhere but New's In Japan
// side, which asks for the Japanese one first (`japanFirst`). A cover the
// reader pasted a link to themselves is theirs: it's never swapped.
//
// Use SeriesPicture for a series (components/cover/SeriesPicture.tsx) and
// Cover for a volume (components/cover/Cover.tsx); they do all of this.
// Pure, so the server's tests can load it.

// the widths the server makes: the same list as its COVER_WIDTHS, change
// both together
export const COVER_WIDTHS = [120, 220, 330, 480] as const;

export type CoverChoice = { url: string; width: number };

const OUR_ROUTE = /^(\/api\/prices\/cover\/\d{13})(?:\?.*)?$/;
const ANILIST =
  /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/manga\/cover\/(?:small|medium|large)\/[\w.-]+$/;

// A volume's own cover, looked up by its ISBN. (Only these can turn out to
// be a store's "No image available" picture, which the Cover hides)
export const isVolumeCover = (url: string) => OUR_ROUTE.test(url);

// Which series the cover is for, when it's a series' cover
export type ForSeries = { name: string; japanFirst?: boolean };

// A cover picked for the reader from a catalog (AniList, or MyAnimeList and
// Kitsu from a list import): the Japanese edition's. Any other address is a
// link they pasted themselves (the cover picker tells them apart the same
// way)
const FROM_A_CATALOG = /anilist\.co|myanimelist|kitsu/i;
export const isOwnPick = (url: string) =>
  !FROM_A_CATALOG.test(url) && !OUR_ROUTE.test(url);

const everyWidth = (address: string): CoverChoice[] =>
  COVER_WIDTHS.map((width) => ({ url: `${address}w=${width}`, width }));

// Every width this cover can be had at, narrowest first. One entry (the
// address as given, width 0) for a cover we can't resize; none when there's
// nothing to ask for. `series`: it's that series' cover, so the English
// one is asked for by name
export function coverChoices(
  url: string | null | undefined,
  series?: ForSeries,
): CoverChoice[] {
  const ours = url?.match(OUR_ROUTE);
  if (ours) return everyWidth(`${ours[1]}?`);
  const anilist = url && ANILIST.test(url) ? url : null;
  if (series && !(url && isOwnPick(url))) {
    const asked = new URLSearchParams({ name: series.name });
    if (anilist) asked.set("u", anilist);
    if (series.japanFirst) asked.set("first", "japan");
    return everyWidth(`/api/prices/cover/series?${asked}&`);
  }
  if (anilist)
    return everyWidth(
      `/api/prices/cover/series?u=${encodeURIComponent(anilist)}&`,
    );
  return url ? [{ url, width: 0 }] : [];
}

// On a slow or data-saving connection: only the two narrowest, so a sharp
// screen settles for a lighter picture
const SLOW_CHOICES = 2;
export const forSlowConnection = (choices: CoverChoice[]) =>
  choices.slice(0, SLOW_CHOICES);

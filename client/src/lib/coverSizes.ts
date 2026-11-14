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
//   a series' AniList cover   /api/prices/cover/series?u=<its address>&w=330
//   anything else             shown as it is, at its one size
//
// Use the Cover component (components/cover/Cover.tsx), which does all of
// this. Pure, so the server's tests can load it.

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

// Every width this cover can be had at, narrowest first. One entry (the
// address as given, width 0) for a cover we can't resize
export function coverChoices(url: string): CoverChoice[] {
  const ours = url.match(OUR_ROUTE);
  if (ours)
    return COVER_WIDTHS.map((width) => ({
      url: `${ours[1]}?w=${width}`,
      width,
    }));
  if (ANILIST.test(url))
    return COVER_WIDTHS.map((width) => ({
      url: `/api/prices/cover/series?u=${encodeURIComponent(url)}&w=${width}`,
      width,
    }));
  return [{ url, width: 0 }];
}

// On a slow or data-saving connection: only the two narrowest, so a sharp
// screen settles for a lighter picture
const SLOW_CHOICES = 2;
export const forSlowConnection = (choices: CoverChoice[]) =>
  choices.slice(0, SLOW_CHOICES);

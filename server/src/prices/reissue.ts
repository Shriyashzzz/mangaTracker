// A finished manga sold in English today as a reissue numbered its own way,
// whose older run the catalogs still list. Sailor Moon: Kodansha's 12
// volumes (2011 to 2013, after the Japanese reissue) and Mixx/Tokyopop's run
// to vol. 18 (1998 to 2001, after the first Japanese edition). Merged by
// volume number, the list mixed the two and ran to 18, so owning all 12 of
// the edition sold today looked 6 short.
//
// The catalogs can't tell the two runs apart by date (they give Kodansha's
// books the Japanese years, 2003 and 2004), so it's a hand table, as for box
// sets and editions (client lib/imports/bookVolumes.ts): each series' edition
// sold today, from the publisher's own count, and the ISBN blocks its books
// carry. Only the series here change; every other list is left as it is.
// Add one only from the publisher's own volumes
import type { CatalogBook } from "./types.js";
import { slugify } from "./stores/match.js";

export type ListedBook = CatalogBook & { volume: number };

type Reissue = {
  // its English names, as a series page may be asked for it
  names: string[];
  // how many volumes the edition sold today has
  volumes: number;
  // the start of every ISBN of that edition's books
  isbnStarts: string[];
};

const REISSUES: Reissue[] = [
  {
    // Kodansha Comics, 2011 to 2013: 1 to 3 at 978-1-935429, the rest at
    // 978-1-61262
    names: ["Sailor Moon", "Pretty Guardian Sailor Moon"],
    volumes: 12,
    isbnStarts: ["978193542", "978161262"],
  },
];

const reissueOf = (name: string) =>
  REISSUES.find((r) => r.names.some((n) => slugify(n) === slugify(name)));

const isLoneVolume = (book: CatalogBook) =>
  !book.inBook &&
  book.volume != null &&
  Number.isInteger(book.volume) &&
  book.volume >= 1;

// the edition sold today, 1 to its last, when the table knows the series
// and every one of its volumes was found; anything else, the list as it was
export function editionSoldToday(
  // the name asked for, and AniList's
  names: (string | null | undefined)[],
  listed: ListedBook[],
  // every book any catalog answered with, before one was picked per number
  candidates: CatalogBook[],
): ListedBook[] {
  const reissue = names
    .filter((name): name is string => Boolean(name))
    .map(reissueOf)
    .find(Boolean);
  if (!reissue) return listed;
  const isTodays = (book: CatalogBook) =>
    reissue.isbnStarts.some((start) => book.isbn13.trim().startsWith(start));
  const today = new Map<number, CatalogBook>();
  for (const book of [...listed, ...candidates])
    if (
      isLoneVolume(book) &&
      book.volume! <= reissue.volumes &&
      isTodays(book) &&
      !today.has(book.volume!)
    )
      today.set(book.volume!, book);
  // a volume of it the catalogs didn't have: can't be sure, so no change
  for (let n = 1; n <= reissue.volumes; n++) if (!today.has(n)) return listed;
  return [
    // books holding several volumes keep their own numbering
    ...listed.filter((v) => !isLoneVolume(v)),
    ...[...today].map(([n, book]) => ({ ...book, volume: n })),
  ].sort((a, b) => a.volume - b.volume);
}

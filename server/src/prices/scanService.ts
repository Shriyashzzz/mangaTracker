// A barcode scanned on the shelf: which book it is and which series and
// volumes it holds. Part of the price service (service.ts lists the parts).
import { getSeriesInfo } from "./sources/anilist.js";
import {
  isNovelBook,
  normalize,
  seriesName,
  bookNumberOf,
  omnibusVolumes,
  editionOfTitle,
} from "./stores/match.js";
import { baseName, isNovelName, novelName } from "./lightNovel.js";
import { editionVolumes, withoutEdition } from "../util/shelf/editions.js";
import { bookInLine } from "./editionBooks.js";
import { onlyBookOf, volumesByName } from "../util/shelf/editionNames.js";
import { titleVolume } from "./volumeNames.js";
import { getOrCreateBook, getVolumePrices } from "./volumeService.js";
import { getSeriesWithVolumes } from "./seriesService.js";

// ---------- a scanned barcode ----------

// which series and volume a scanned ISBN is, for adding it to a shelf. The
// stored book or the free catalog only: it never asks a store for a price, so
// a scan never spends a paid search. Null when the catalog doesn't know it or
// the title carries no volume number
export async function lookupScannedIsbn(isbn13: string) {
  const book = await getOrCreateBook(isbn13);
  if (!book) return null;
  // "Berserk Deluxe Edition, Vol. 2" is Berserk, and vols 4 to 6
  const fullName = seriesName(book.title);
  const named = withoutEdition(fullName);
  const inEdition = editionVolumes(
    fullName,
    book.title,
    titleVolume(book.title),
  );
  // a book holding several volumes ("Vinland Saga, Book 9"): the series'
  // list says which, and every one of them goes on the shelf
  const inBook =
    bookNumberOf(book.title) === null
      ? null
      : ((await getSeriesWithVolumes(named).catch(() => null))?.volumes.find(
          (v) => v.isbn13 === book.isbn13 && v.inBook,
        )?.inBook ?? null);
  // any other edition's book ("Vagabond Definitive Edition, Vol. 1"): the
  // series' edition lines say what it holds (prices/editionBooks.ts)
  // What an edition's book holds, the most certain first:
  //   1. the hand-kept table of uneven editions (inEdition)
  //   2. its own title ("Omnibus 1 (Vol. 1-3)", "Naruto #1-3", or each
  //      volume's name in brackets)
  //   3. its series' edition lines, built from the catalog
  //   4. its edition's name, when the name is the count (book 2 of a
  //      VIZBIG or a 3-in-1 holds vols 4 to 6)
  // then nothing at all for an omnibus that can't say (never a guess)
  const edition = editionOfTitle(book.title);
  const stated = omnibusVolumes(book.title);
  let held: number[] | null = inEdition ?? (stated?.length ? stated : null);
  if (!inBook && !held && edition)
    held =
      (await volumesInItsLine(named, book.isbn13)) ??
      volumesByName(edition, titleVolume(book.title) ?? onlyBookOf(edition));
  const omnibus = inBook ? null : (held ?? stated);
  if (omnibus && !omnibus.length) return null;
  // the first volume it holds: as its series' list says, as its title
  // says, or the one volume its title names
  let volume = titleVolume(book.title);
  if (inBook) volume = inBook.from;
  else if (omnibus) volume = omnibus[0]!;
  if (volume == null) return null;
  // the catalog sometimes says so only in brackets ("Overlord, Vol. 3 (light
  // novel)"), which seriesName drops
  const lightNovel =
    isNovelName(named) ||
    isNovelBook(book.title) ||
    /\blight novel\b/i.test(book.title);
  // a novel goes by "Overlord Light Novel", so the shelf match finds the
  // novel and never the manga of the same name
  const series = lightNovel ? novelName(baseName(named)) : named;
  // the shelf keeps AniList's spelling ("One Piece", not the catalog's "ONE
  // PIECE"), but only when it's the same name apart from capitals and
  // punctuation, so a scan never lands under another series
  const info = await getSeriesInfo(series).catch(() => null);
  const ownName = lightNovel ? baseName(series) : series;
  const spelled = info && (lightNovel ? baseName(info.name) : info.name);
  // (spaces too: a catalog's "Dragonball" is AniList's "Dragon Ball")
  const letters = (name: string) => normalize(name).replace(/\s+/g, "");
  const shelfName =
    spelled && letters(spelled) === letters(ownName) ? spelled : ownName;
  return {
    isbn13: book.isbn13,
    title: book.title,
    volume,
    // every volume it holds, when it's one book holding several
    volumes: inBook
      ? Array.from(
          { length: inBook.to - inBook.from + 1 },
          (_, i) => inBook.from + i,
        )
      : (omnibus ?? [volume]),
    // the price checker's name ("Overlord Light Novel"), for /api/manga/match
    series,
    // the name a shelf keeps it under: a novel is the series' own name, marked
    shelfName,
    lightNovel,
    coverUrl: book.coverUrl,
  };
}

// the volumes an edition's book holds, from its series' edition lines; null
// when no line lists it (the book then goes by the number in its title)
async function volumesInItsLine(series: string, isbn13: string) {
  // by the series' name alone when its own list can't be read (AniList
  // slow or down): the lines come from the catalog, not from AniList
  const found = await getSeriesWithVolumes(series).catch(() => null);
  const inLine = await bookInLine(
    found ?? { name: series, volumes: [] },
    isbn13,
  ).catch(() => null);
  return inLine?.book.volumes.length ? inLine.book.volumes : null;
}

export type ScannedBook = NonNullable<
  Awaited<ReturnType<typeof lookupScannedIsbn>>
>;

export type VolumePrices = NonNullable<
  Awaited<ReturnType<typeof getVolumePrices>>
>;

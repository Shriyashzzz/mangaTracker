// A barcode scanned on the shelf: which book it is and which series and
// volumes it holds. Part of the price service (service.ts lists the parts).
import { getSeriesInfo } from "./sources/anilist.js";
import {
  isNovelBook,
  normalize,
  seriesName,
  bookNumberOf,
  omnibusVolumes,
} from "./stores/match.js";
import { baseName, isNovelName, novelName } from "./lightNovel.js";
import { editionVolumes, withoutEdition } from "../util/shelf/editions.js";
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
  // an omnibus ("One Piece, Vol. 1 (Romance Dawn / … )" is vols 1 to 3):
  // every volume in it, or nothing at all when it can't say which
  const omnibus = inBook ? null : (inEdition ?? omnibusVolumes(book.title));
  if (omnibus && !omnibus.length) return null;
  const volume = inBook
    ? inBook.from
    : omnibus
      ? omnibus[0]!
      : titleVolume(book.title);
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
  const shelfName =
    spelled && normalize(spelled) === normalize(ownName) ? spelled : ownName;
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

export type ScannedBook = NonNullable<
  Awaited<ReturnType<typeof lookupScannedIsbn>>
>;

export type VolumePrices = NonNullable<
  Awaited<ReturnType<typeof getVolumePrices>>
>;

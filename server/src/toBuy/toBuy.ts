// A reader's To buy list: volumes they looked up and mean to buy, each with
// its cheapest new and used copy now. Prices come from what's stored: the
// list never asks a store, so opening it costs nothing.
import { prisma } from "../config/prisma.js";
import { hasNoCover } from "../models/coversAndSitemap.js";
import priceQueries from "../models/priceQueries.js";
import type { Country } from "../models/priceTables.js";
import type { CheapestCopy } from "../models/priceHistory.js";
import { linkFor } from "../prices/canada/canadaLinks.js";
import { notOutYet } from "../prices/preorder.js";
import { getOrCreateBook } from "../prices/service.js";
import { getSeriesInfo } from "../prices/sources/anilist.js";
import {
  editionOfTitle,
  omnibusVolumes,
  seriesOfBook,
} from "../prices/stores/match.js";
import { findOnShelf } from "../prices/shelfService.js";
import { isNovelName, priceName } from "../prices/lightNovel.js";
import mangaQueries from "../models/mangaQueries.js";
import { ownedSet } from "../collector/shelfMath.js";
import { ownedVolumes } from "../util/shelf/ownedList.js";
import { oneAtATime } from "../util/shelf/oneAtATime.js";
import { onShelfAs } from "../util/shelf/titleKey.js";
import { canonicalTitle } from "../util/shelf/canonicalTitle.js";
import { shopName, titleVolume } from "../prices/volumeNames.js";

// plenty for a shopping list, and it keeps one account's list a quick read
export const MOST_TO_BUY = 200;

// a price on the list: how much, and where
type Price = { cents: number; store: string; url: string | null } | null;

export type ToBuyItem = {
  isbn13: string;
  title: string;
  series: string;
  // null for a book that isn't one numbered volume (a box set, a guide)
  volume: number | null;
  // the series' volumes it certainly holds (volumesOf): what "I bought it"
  // and "I ordered it" act on. null: not known for sure, so they act on none
  volumes: number[] | null;
  // an edition's book (Deluxe, VIZBIG), not one volume
  edition: boolean;
  // the series on their shelf it belongs to, and whether they have all it
  // holds already, or have it on order (said on the list; never acted on
  // without them)
  shelf: { id: number; name: string; state: "owned" | "ordered" | null } | null;
  // its cover as its own price page has it (none for an edition known to
  // have no picture), and its series' cover to stand in behind it
  coverUrl: string | null;
  seriesCoverUrl: string | null;
  new: Price;
  used: Price;
  // its release date ("2027-03-30", or just "2027-03") while it isn't out
  // yet: a preorder, which is why it has no price
  outOn: string | null;
  addedAt: Date;
  // their own note on it ("wait for a sale"), and its place in their own
  // order; null until they've set one
  note: string | null;
  position: number | null;
  // the price they asked to be told at: an alert goes to their phone when
  // a copy is at or under it. Null: none named
  alertCents: number | null;
};

// the release date of a volume that isn't out yet, from its series' saved
// list; null for one that's out, or whose date nobody knows
const preorderDate = async (isbn13: string) => {
  const saved = await priceQueries.getSavedVolume(isbn13).catch(() => null);
  return notOutYet(saved?.published);
};

// what the list would cost: each kind added up over the volumes that have a
// price of that kind, with how many that is, so the page can say "3 of 5"
// (only each copy's price is read)
type Priced = { cents: number } | null;
export function toBuyTotals(items: { new: Priced; used: Priced }[]) {
  const sum = (kind: "new" | "used") => {
    const priced = items.flatMap((item) => item[kind] ?? []);
    return {
      cents: priced.reduce((total, price) => total + price.cents, 0),
      volumes: priced.length,
    };
  };
  return { volumes: items.length, new: sum("new"), used: sum("used") };
}

// The series' volumes a book certainly holds: a plain volume, itself; an
// edition's book, the ones its title lists ("Includes vols. 19, 20 & 21").
// null when that isn't certain: an edition's book whose title doesn't say,
// a box set, a guide. Never a guess: Deluxe 3 isn't vol. 3, and people buy
// by what this says
export function volumesOf(title: string): number[] | null {
  if (editionOfTitle(title)) {
    const listed = omnibusVolumes(title);
    return listed?.length ? listed : null;
  }
  const volume = titleVolume(title);
  return volume == null ? null : [volume];
}

// the reader's shelf, as the series matcher reads it (manga's /match)
async function shelfOf(userId: number) {
  return (await mangaQueries.getShelf(userId)).map((m) => ({
    ...m,
    shelfName: m.name,
    name: priceName(m),
  }));
}
type ShelfEntry = Awaited<ReturnType<typeof shelfOf>>[number];

// A light novel's book, read from its whole title: "Overlord, Vol. 3
// (light novel)" and "Classroom of the Elite (Light Novel) Vol. 2" are, though
// their series' names may have lost the words. Never matched to the manga of
// the same name, nor the other way round
export const isNovelBook = (title: string) =>
  /\blight[\s-]+novels?\b/i.test(title) || isNovelName(seriesOfBook(title));

// the shelf entry a book's series is, light novel or manga as the book says
const entryFor = (shelf: ShelfEntry[], series: string, lightNovel: boolean) =>
  findOnShelf(
    shelf.filter((m) => Boolean(m.lightNovel) === lightNovel),
    series,
  );

// all it holds owned, or all it lacks on order
function stateOf(entry: ShelfEntry, volumes: number[] | null) {
  if (!volumes) return null;
  const owned = ownedSet(entry);
  const missing = volumes.filter((v) => !owned.has(v));
  if (!missing.length) return "owned" as const;
  return missing.every((v) => entry.orderedList.includes(v))
    ? ("ordered" as const)
    : null;
}

// a copy as the list shows it: its price, its store's name, and the way
// to it at that store (our link where we have a tag; null when there's none)
const priceOf = (
  copy: CheapestCopy | null | undefined,
  condition: "new" | "used",
  isbn13: string,
  country: Country,
): Price => {
  if (!copy) return null;
  const { url } = linkFor(
    country,
    { ...copy, format: "print", condition },
    isbn13,
  );
  return { cents: copy.cents, store: shopName(copy.store), url: url ?? null };
};

// the list, newest first, with its totals
export async function toBuyList(userId: number, country: Country = "us") {
  const rows = await prisma.toBuy.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });
  const isbns = rows.map((row) => row.isbn13.trim());
  const [books, copies, coverRows] = await Promise.all([
    prisma.book.findMany({ where: { isbn13: { in: isbns } } }),
    priceQueries.getCheapestCopies(isbns, undefined, country),
    priceQueries.getCoverIds(isbns).catch(() => []),
  ]);
  const bookOf = new Map(books.map((b) => [b.isbn13.trim(), b]));
  const coverRowOf = new Map(coverRows.map((c) => [c.isbn13.trim(), c]));
  // each series' own cover, once per series, as the deals list finds it
  const seriesNames = [...new Set(books.map((b) => seriesOfBook(b.title)))];
  const seriesCovers = new Map(
    await Promise.all(
      seriesNames.map(async (name) => {
        const info = await getSeriesInfo(name).catch(() => null);
        return [name, info?.coverUrl ?? null] as const;
      }),
    ),
  );
  // only a volume with no price can be a preorder: the rest aren't asked about
  const unpriced = isbns.filter(
    (isbn13) => !copies.get(isbn13)?.new && !copies.get(isbn13)?.used,
  );
  const outOn = new Map(
    await Promise.all(
      unpriced.map(
        async (isbn13) => [isbn13, await preorderDate(isbn13)] as const,
      ),
    ),
  );
  // where each sits on their shelf, matched once a series (and kind)
  const shelf = await shelfOf(userId);
  const keyOf = (title: string) =>
    `${seriesOfBook(title)}|${isNovelBook(title) ? "novel" : "manga"}`;
  const entryOf = new Map(
    await Promise.all(
      [...new Set(books.map((b) => keyOf(b.title)))].map(async (key) => {
        const [name, kind] = key.split("|") as [string, string];
        return [key, await entryFor(shelf, name, kind === "novel")] as const;
      }),
    ),
  );
  const items: ToBuyItem[] = rows.flatMap((row) => {
    const isbn13 = row.isbn13.trim();
    const book = bookOf.get(isbn13);
    // its book is gone: nothing to show or price
    if (!book) return [];
    const { title } = book;
    return {
      isbn13,
      title,
      series: seriesOfBook(title),
      volume: titleVolume(title),
      volumes: volumesOf(title),
      edition: Boolean(editionOfTitle(title)),
      shelf: shelfLine(entryOf.get(keyOf(title)), volumesOf(title)),
      coverUrl: hasNoCover(coverRowOf.get(isbn13)) ? null : book.coverUrl,
      seriesCoverUrl: seriesCovers.get(seriesOfBook(title)) ?? null,
      new: priceOf(copies.get(isbn13)?.new, "new", isbn13, country),
      used: priceOf(copies.get(isbn13)?.used, "used", isbn13, country),
      outOn: outOn.get(isbn13) ?? null,
      addedAt: row.addedAt,
      note: row.note,
      position: row.position,
      alertCents: row.alertCents,
    };
  });
  return { items, totals: toBuyTotals(items) };
}

// adds a volume. "unknown": no such book; "full": the list is at its most
export async function addToBuy(
  userId: number,
  isbn13: string,
): Promise<"added" | "unknown" | "full"> {
  const book = await getOrCreateBook(isbn13);
  if (!book) return "unknown";
  const [already, count] = await Promise.all([
    prisma.toBuy.findUnique({ where: { userId_isbn13: { userId, isbn13 } } }),
    prisma.toBuy.count({ where: { userId } }),
  ]);
  if (already) return "added";
  if (count >= MOST_TO_BUY) return "full";
  await prisma.toBuy.create({ data: { userId, isbn13 } });
  return "added";
}

// empties the list. Nothing on their shelf changes
export const clearToBuy = (userId: number) =>
  prisma.toBuy.deleteMany({ where: { userId } });

// takes a volume off; one that wasn't there is fine
const shelfLine = (
  entry: ShelfEntry | null | undefined,
  volumes: number[] | null,
): ToBuyItem["shelf"] =>
  entry
    ? { id: entry.id, name: entry.shelfName, state: stateOf(entry, volumes) }
    : null;

// "I bought it" or "I ordered it": the book comes off the list and, when its
// series is on their shelf and the volumes it holds are certain, they're
// owned or on order there. Nothing is guessed or added: a series not on the
// shelf, or a book whose volumes aren't certain, is only taken off the list,
// and the answer says which, so the page can say what to do. Under the
// reader's lock, as every shelf save is
export type Settled = {
  // what was done on the shelf: "owned", "ordered", or nothing
  done: "owned" | "ordered" | null;
  series: string;
  shelf: { id: number; name: string } | null;
  // the volumes it holds, when certain
  volumes: number[] | null;
  // a light novel's book (from its whole title: the series' name may have
  // lost the words), so "Add it to your shelf?" looks up the novel
  lightNovel: boolean;
};

export async function settleToBuy(
  userId: number,
  isbn13: string,
  how: "owned" | "ordered",
): Promise<Settled | "gone"> {
  return oneAtATime(userId, async () => {
    const book = await prisma.book.findUnique({ where: { isbn13 } });
    const onList = await prisma.toBuy.findUnique({
      where: { userId_isbn13: { userId, isbn13 } },
    });
    if (!book || !onList) return "gone" as const;
    const series = seriesOfBook(book.title);
    const volumes = volumesOf(book.title);
    const entry = await entryFor(
      await shelfOf(userId),
      series,
      isNovelBook(book.title),
    );
    let done: Settled["done"] = null;
    if (entry && volumes) {
      await putOnShelf(entry, volumes, how);
      done = how;
    }
    await removeToBuy(userId, isbn13);
    return {
      done,
      series,
      shelf: entry ? { id: entry.id, name: entry.shelfName } : null,
      volumes,
      lightNovel: isNovelBook(book.title),
    };
  });
}

// the volumes owned, or on order (those not owned already), on one entry
async function putOnShelf(
  entry: {
    id: number;
    volumesOwned: number | null;
    ownedList: number[];
    orderedList: number[];
  },
  volumes: number[],
  how: "owned" | "ordered",
) {
  const owned = ownedSet(entry);
  if (how === "owned") {
    await mangaQueries.setVolumesOwned(
      entry.id,
      ownedVolumes(null, [...owned, ...volumes]),
    );
    return;
  }
  const missing = volumes.filter((v) => !owned.has(v));
  await mangaQueries.setOrdered(
    entry.id,
    [...new Set([...entry.orderedList, ...missing])].sort((a, b) => a - b),
  );
}

// "Add it to your shelf?" after On my shelf or Ordered, for a series not on
// it: the series added (To read, or Reading), with the book's volumes owned
// or ordered when they're certain. The name is theirs to correct; a manga's
// is put the way AniList names it, as Add manga does. One already on the
// shelf by that name isn't added twice: the volumes go on it instead. One
// request, under the reader's lock, so nothing is half done
export type AddedFromToBuy = {
  added: boolean;
  id: number;
  name: string;
  done: "owned" | "ordered" | null;
  volumes: number[] | null;
};

export async function addFromToBuy(
  userId: number,
  isbn13: string,
  asked: {
    name: string;
    planned: boolean;
    how: "owned" | "ordered";
    // the other volumes they ticked on the modal's shelf: theirs already
    owned?: number[];
    // the chapter they've read up to, when they're reading it
    bookmark?: number | null;
  },
): Promise<AddedFromToBuy | "gone"> {
  const book = await prisma.book.findUnique({ where: { isbn13 } });
  if (!book) return "gone";
  const lightNovel = isNovelBook(book.title);
  const volumes = volumesOf(book.title);
  // an edition's book collects the series as that edition (Deluxe, VIZBIG)
  const edition = editionOfTitle(book.title)?.key ?? null;
  // what's theirs: what they ticked, and the book when it's bought
  const theirs = [
    ...new Set([
      ...(asked.owned ?? []),
      ...(volumes && asked.how === "owned" ? volumes : []),
    ]),
  ];
  const name = lightNovel
    ? asked.name
    : canonicalTitle(
        asked.name,
        await getSeriesInfo(asked.name).catch(() => null),
      );
  return oneAtATime(userId, async () => {
    const shelf = await mangaQueries.getMangaShelfNames(userId);
    const there = onShelfAs(name, shelf, undefined, lightNovel);
    if (there) {
      const entry = (await mangaQueries.getManga(there.id))!;
      if (theirs.length) await putOnShelf(entry, theirs, "owned");
      if (volumes && asked.how === "ordered") {
        const now = (await mangaQueries.getManga(there.id))!;
        await putOnShelf(now, volumes, "ordered");
      }
      return {
        added: false,
        id: entry.id,
        name: entry.name,
        done: volumes ? asked.how : null,
        volumes,
      };
    }
    const id = await mangaQueries.addManga(userId, {
      name,
      status: false,
      planned: asked.planned,
      lightNovel,
      ...(edition ? { edition } : {}),
      // a place only for one they're reading
      ...(!asked.planned && asked.bookmark ? { bookmark: asked.bookmark } : {}),
      ...(theirs.length ? ownedVolumes(null, theirs) : {}),
    });
    if (volumes && asked.how === "ordered")
      await mangaQueries.setOrdered(
        id,
        volumes.filter((v) => !theirs.includes(v)),
      );
    return {
      added: true,
      id,
      name,
      done: volumes ? asked.how : null,
      volumes,
    };
  });
}

// their note on one item: empty takes it off. Nothing when it isn't on
// their list
export const TO_BUY_NOTE_MAX = 140;
export const setToBuyNote = (userId: number, isbn13: string, note: string) =>
  prisma.toBuy.updateMany({
    where: { userId, isbn13 },
    data: { note: note.trim().slice(0, TO_BUY_NOTE_MAX) || null },
  });

// the price they want to be told at, in cents; null takes it off. Nothing
// when it isn't on their list
export const TO_BUY_ALERT_MOST_CENTS = 100_000;
export const setToBuyAlert = (
  userId: number,
  isbn13: string,
  alertCents: number | null,
) =>
  prisma.toBuy.updateMany({
    where: { userId, isbn13 },
    data: { alertCents },
  });

// their own order: each listed item takes its place in the list given.
// Only ever their own rows; an ISBN that isn't on their list changes nothing
export const setToBuyOrder = (userId: number, isbns: string[]) =>
  prisma.$transaction(
    isbns.map((isbn13, position) =>
      prisma.toBuy.updateMany({
        where: { userId, isbn13 },
        data: { position },
      }),
    ),
  );

export const removeToBuy = (userId: number, isbn13: string) =>
  prisma.toBuy.deleteMany({ where: { userId, isbn13 } });

// The shelf tools: what a shelf is worth, what finishing each series costs,
// what's coming out, and the stores' sales. Sandboxed here with their own
// routes (/api/collector) and switch (COLLECTOR_TOOLS=off). They read the
// shelf, the saved series lists and the prices already saved: never a store,
// a catalog or a paid search.
import bookQueries from "../models/bookQueries.js";
import mangaQueries from "../models/mangaQueries.js";
import priceQueries from "../models/priceQueries.js";
import { affiliateOfferUrl } from "../prices/stores/storeLinks.js";
import {
  median,
  ownedSet,
  finishSeries,
  finishEdition,
  shelfValue,
  upcoming,
  type MissingVolume,
  type ShelfValue,
} from "./shelfMath.js";
import { shelfEditionLines, shelfSeries } from "./shelfSeries.js";

export type FinishRow = {
  mangaId: number;
  name: string;
  missing: MissingVolume[];
  cents: number;
  priced: number;
  estimateCents: number | null;
  // counted in this edition's books ("Deluxe"), not single volumes
  edition?: string;
};

export type ShelfTools = {
  value: ShelfValue;
  // what they've said they paid, added up, and for how many books
  spent: { cents: number; books: number };
  // series they own some of, with volumes out they don't own yet
  finish: FinishRow[];
  // every series' priced missing volumes, added up
  finishCents: number;
  finishPriced: number;
  finishMissing: number;
  // the series priced enough to say, added up (null: none is)
  finishEstimateCents: number | null;
  // series left out of that total: too little of them priced yet
  finishUncosted: number;
};

// the cheapest copy's link with our affiliate tag, as the price pages give it
function tagged(missing: MissingVolume): MissingVolume {
  const cheapest = missing.cheapest;
  if (!cheapest) return missing;
  const url = affiliateOfferUrl(
    { ...cheapest, format: "print", condition: "new" },
    missing.isbn13,
  );
  return { ...missing, cheapest: { ...cheapest, url } };
}

const sum = (numbers: number[]) => {
  let total = 0;
  for (const n of numbers) total += n;
  return total;
};

// a whole-numbered volume from 1, as the shelf counts them
const isMainVolume = (volume: number) =>
  volume >= 1 && Number.isInteger(volume);

export async function getShelfTools(userId: number): Promise<ShelfTools> {
  const shelf = await mangaQueries.getShelf(userId);
  const [series, lines] = await Promise.all([
    // each series with its saved list of volumes
    shelfSeries(shelf),
    // the edition each series is collected in, where one is chosen
    shelfEditionLines(shelf),
  ]);

  // every book whose price matters: each series' volumes and edition books
  const isbns = new Set<string>();
  for (const s of series) for (const v of s.volumes) isbns.add(v.isbn13);
  for (const line of lines.values())
    for (const book of line.books) if (book.isbn13) isbns.add(book.isbn13);
  const [copies, recorded] = await Promise.all([
    priceQueries.getCheapestCopies([...isbns]),
    priceQueries.getRecordedMedians([...isbns]),
  ]);

  // owned volumes of series with no saved list: in the estimate only
  const listedIds = new Set(series.map((s) => s.manga.id));
  let unlisted = 0;
  for (const manga of shelf) {
    if (listedIds.has(manga.id)) continue;
    unlisted += [...ownedSet(manga)].filter(isMainVolume).length;
  }
  const ownedBySeries = series.map((s) => ({
    owned: { volumesOwned: s.manga.volumesOwned, ownedList: s.manga.ownedList },
    volumes: s.volumes,
  }));

  // the shelf's usual new price, for a series with none of its own priced
  const recordedNew: number[] = [];
  for (const price of recorded.values())
    if (price.new) recordedNew.push(price.new);
  const shelfNew = median(recordedNew);

  // what's left to buy of each series they own some of
  const finish: FinishRow[] = [];
  for (const s of series) {
    if (ownedSet(s.manga).size === 0) continue;
    // counted in the books of the edition they collect, when they do
    const line = lines.get(s.manga.id);
    const left = line
      ? finishEdition(s.manga, line, copies, shelfNew, recorded)
      : finishSeries(
          s.manga,
          s.volumes,
          copies,
          new Date(),
          shelfNew,
          recorded,
        );
    if (!left.missing.length) continue;
    finish.push({
      mangaId: s.manga.id,
      name: s.manga.name,
      ...(line ? { edition: line.label } : {}),
      ...left,
      missing: left.missing.map(tagged),
    });
  }

  // only the series priced enough to say a total: the rest are counted, not
  // costed
  const costed = finish.filter((row) => row.estimateCents !== null);
  const spent = await bookQueries
    .shelfSpent(userId)
    .catch(() => ({ cents: 0, books: 0 }));
  return {
    value: shelfValue(ownedBySeries, recorded, unlisted),
    spent,
    finish,
    finishCents: sum(finish.map((row) => row.cents)),
    finishPriced: sum(finish.map((row) => row.priced)),
    finishMissing: sum(finish.map((row) => row.missing.length)),
    finishEstimateCents: costed.length
      ? sum(costed.map((row) => row.estimateCents ?? 0))
      : null,
    finishUncosted: finish.length - costed.length,
  };
}

export type CalendarEntry = ReturnType<typeof upcoming>[number] & {
  mangaId: number;
  name: string;
  // the series' cover on the shelf: a volume this far off rarely has its own
  seriesCover: string | null;
  // they own it already (preordered and marked)
  owned: boolean;
};

// upcoming volumes of every series on the shelf, soonest first, by month
export async function getCalendar(userId: number) {
  const series = await shelfSeries(await mangaQueries.getShelf(userId));
  const all: CalendarEntry[] = [];
  for (const s of series) {
    const mine = ownedSet(s.manga);
    for (const coming of upcoming(s.volumes))
      all.push({
        ...coming,
        mangaId: s.manga.id,
        name: s.manga.name,
        seriesCover: s.manga.image ?? null,
        owned: coming.volume !== null && mine.has(coming.volume),
      });
  }
  all.sort((a, b) => a.published.localeCompare(b.published));

  // one series on the shelf twice lists its volumes once, owned if either
  // entry owns it
  const byIsbn = new Map<string, CalendarEntry>();
  for (const entry of all) {
    const first = byIsbn.get(entry.isbn13);
    if (first) first.owned ||= entry.owned;
    else byIsbn.set(entry.isbn13, entry);
  }

  const months = new Map<string, CalendarEntry[]>();
  for (const entry of byIsbn.values()) {
    const volumes = months.get(entry.month) ?? [];
    volumes.push(entry);
    months.set(entry.month, volumes);
  }
  return [...months].map(([month, volumes]) => ({ month, volumes }));
}

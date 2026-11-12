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
  // with the unpriced ones estimated (null: nothing priced to go by)
  finishEstimateCents: number | null;
};

// the cheapest copy's link with our affiliate tag, as the price pages give it
const tagged = (m: MissingVolume): MissingVolume =>
  m.cheapest
    ? {
        ...m,
        cheapest: {
          ...m.cheapest,
          url: affiliateOfferUrl(
            { ...m.cheapest, format: "print", condition: "new" },
            m.isbn13,
          ),
        },
      }
    : m;

export async function getShelfTools(userId: number): Promise<ShelfTools> {
  const shelf = await mangaQueries.getShelf(userId);
  const [series, lines] = await Promise.all([
    shelfSeries(shelf),
    // the edition each series is collected in, where one is chosen
    shelfEditionLines(shelf),
  ]);
  const isbns = [
    ...new Set([
      ...series.flatMap((s) => s.volumes.map((v) => v.isbn13)),
      ...[...lines.values()].flatMap((l) =>
        l.books.flatMap((b) => b.isbn13 ?? []),
      ),
    ]),
  ];
  const [copies, recorded] = await Promise.all([
    priceQueries.getCheapestCopies(isbns),
    priceQueries.getRecordedMedians(isbns),
  ]);
  // owned volumes of series with no saved list: in the estimate only
  const listedIds = new Set(series.map((s) => s.manga.id));
  const unlisted = shelf
    .filter((m) => !listedIds.has(m.id))
    .reduce(
      (sum, m) =>
        sum +
        [...ownedSet(m)].filter((v) => v >= 1 && Number.isInteger(v)).length,
      0,
    );
  const owned = series.map((s) => ({
    owned: { volumesOwned: s.manga.volumesOwned, ownedList: s.manga.ownedList },
    volumes: s.volumes,
  }));
  // the shelf's usual new price, for a series with none of its own priced
  const shelfNew = median(
    [...recorded.values()].flatMap((r) => (r.new ? [r.new] : [])),
  );
  const finish = series
    .filter((s) => ownedSet(s.manga).size > 0)
    .flatMap((s) => {
      // counted in the books of the edition they collect, when they do
      const line = lines.get(s.manga.id);
      const f = line
        ? finishEdition(s.manga, line, copies, shelfNew, recorded)
        : finishSeries(
            s.manga,
            s.volumes,
            copies,
            new Date(),
            shelfNew,
            recorded,
          );
      return f.missing.length
        ? [
            {
              mangaId: s.manga.id,
              name: s.manga.name,
              ...(line ? { edition: line.label } : {}),
              ...f,
              missing: f.missing.map(tagged),
            },
          ]
        : [];
    });
  return {
    value: shelfValue(owned, recorded, unlisted),
    spent: await bookQueries
      .shelfSpent(userId)
      .catch(() => ({ cents: 0, books: 0 })),
    finish,
    finishCents: finish.reduce((sum, f) => sum + f.cents, 0),
    finishPriced: finish.reduce((sum, f) => sum + f.priced, 0),
    finishMissing: finish.reduce((sum, f) => sum + f.missing.length, 0),
    finishEstimateCents: finish.some((f) => f.estimateCents !== null)
      ? finish.reduce((sum, f) => sum + (f.estimateCents ?? f.cents), 0)
      : null,
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
  const entries: CalendarEntry[] = series
    .flatMap((s) => {
      const mine = ownedSet(s.manga);
      return upcoming(s.volumes).map((u) => ({
        ...u,
        mangaId: s.manga.id,
        name: s.manga.name,
        seriesCover: s.manga.image ?? null,
        owned: u.volume !== null && mine.has(u.volume),
      }));
    })
    .sort((a, b) => a.published.localeCompare(b.published))
    // one series on the shelf twice lists its volumes once (owned in either)
    .filter((e, i, all) => {
      const first = all.findIndex((o) => o.isbn13 === e.isbn13);
      if (first !== i) all[first]!.owned ||= e.owned;
      return first === i;
    });
  const months = new Map<string, CalendarEntry[]>();
  for (const e of entries)
    months.set(e.month, [...(months.get(e.month) ?? []), e]);
  return [...months].map(([month, volumes]) => ({ month, volumes }));
}

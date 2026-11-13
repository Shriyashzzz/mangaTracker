// A series' box sets, looked for on purpose: until now one was only found by
// luck, when a volume it holds had its price checked. This asks the two free
// sources by the series' name (eBay's Browse API, and Books-A-Million's
// catalog through CJ), one search each, and keeps what they say beside the
// series' other lists (series_volumes, ":boxsets") for three days. Never a
// paid search: nothing here goes near SerpApi. Each search still counts
// against its source's own free daily allowance, and when that's gone the
// saved answer stays.
import priceQueries from "../models/priceQueries.js";
import { searchBamSets } from "./providers/booksAMillion.js";
import { ebayApiEnabled, searchEbaySets } from "./providers/ebay.js";
import { isNovelName } from "./lightNovel.js";
import { volumesKey } from "./volumesKey.js";
import type { CatalogBook, Offer } from "./types.js";

const FRESH_MS = 3 * 24 * 60 * 60 * 1000;
// after a scan that couldn't run (a source down, the day's calls used up)
const RETRY_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 12_000;
const setsKey = (name: string) => volumesKey(name) + ":boxsets";

export type ScannedSet = Pick<
  Offer,
  "store" | "priceCents" | "url" | "condition"
> & { format: "set" };

// what the last scan found, and when
export async function savedBoxSets(name: string) {
  const row = await priceQueries
    .getSeriesVolumes(setsKey(name))
    .catch(() => null);
  return row && { at: row.at, sets: row.volumes as unknown as ScannedSet[] };
}

type NumberedTitle = Pick<CatalogBook, "volume" | "title">;

// the volumes a search is read against: the first, the middle and the last,
// so a set holding any third of the run is recognised
export const sampleTitles = (volumes: NumberedTitle[]) => {
  const numbered = volumes
    .filter(
      (v) => v.volume != null && Number.isInteger(v.volume) && v.volume >= 1,
    )
    .sort((a, b) => a.volume! - b.volume!);
  if (!numbered.length) return [];
  const first = numbered[0]!;
  const middle = numbered[Math.floor((numbered.length - 1) / 2)]!;
  const last = numbered.at(-1)!;
  // a short series gives the same volume twice: each title once
  return [...new Set([first.title, middle.title, last.title])];
};

// when each series was last tried, so a scan that failed isn't retried at once
const triedAt = new Map<string, number>();
const MOST_REMEMBERED = 5000;
// scans running now, so two visitors on one page share one scan
const inFlight = new Map<string, Promise<boolean>>();

const isEbay = (set: ScannedSet) => /^ebay/i.test(set.store);
const isBam = (set: ScannedSet) => /books-a-million/i.test(set.store);

// asks both sources and saves what they found. Whether anything was saved:
// both sources failing saves nothing, so the old answer stays
async function runScan(
  name: string,
  titles: string[],
  savedSets: ScannedSet[],
): Promise<boolean> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  // a light novel is filed by its series' name, without the words
  const bamName = name.replace(/\s*light novel$/i, "");
  const [ebay, bam] = await Promise.allSettled([
    ebayApiEnabled()
      ? searchEbaySets(titles, signal)
      : Promise.reject(new Error("eBay isn't set up")),
    searchBamSets(bamName, isNovelName(name), signal),
  ]);
  const ebayFailed = ebay.status === "rejected";
  const bamFailed = bam.status === "rejected";
  if (ebayFailed && bamFailed) return false;

  const offers = [
    ...(ebayFailed ? [] : ebay.value),
    ...(bamFailed ? [] : bam.value),
  ];
  const found: ScannedSet[] = offers
    .filter((offer) => offer.inStock && offer.format === "set")
    .map((offer) => ({
      store: offer.store,
      priceCents: offer.priceCents,
      url: offer.url,
      condition: offer.condition,
      format: "set" as const,
    }));
  // a source that failed keeps what it said last time
  const kept = savedSets.filter(
    (set) => (ebayFailed && isEbay(set)) || (bamFailed && isBam(set)),
  );
  // the series' lists are typed as catalog books; this one holds sets
  const toSave = [...found, ...kept] as unknown as CatalogBook[];
  await priceQueries.saveSeriesVolumes(setsKey(name), toSave);
  return true;
}

// looks again when the saved answer is old (or there is none). Whether a new
// answer was saved. A scan that couldn't run is tried again in an hour
export async function scanBoxSets(
  name: string,
  volumes: NumberedTitle[],
): Promise<boolean> {
  const key = setsKey(name);
  const now = Date.now();

  const saved = await savedBoxSets(name);
  const stillFresh = saved ? now - saved.at < FRESH_MS : false;
  if (stillFresh) return false;
  const triedLately = now - (triedAt.get(key) ?? 0) < RETRY_MS;
  if (triedLately) return false;
  const running = inFlight.get(key);
  if (running) return running;
  const titles = sampleTitles(volumes);
  if (!titles.length) return false;

  triedAt.set(key, now);
  // oldest out first, so the map can't grow without end
  if (triedAt.size > MOST_REMEMBERED)
    triedAt.delete(triedAt.keys().next().value!);

  const scan = runScan(name, titles, saved?.sets ?? [])
    .catch(() => false)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, scan);
  return scan;
}

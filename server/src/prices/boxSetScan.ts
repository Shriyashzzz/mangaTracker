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

// the volumes a search is read against: the first, the middle and the last,
// so a set holding any third of the run is recognised
export const sampleTitles = (
  volumes: Pick<CatalogBook, "volume" | "title">[],
) => {
  const numbered = volumes
    .filter(
      (v) => v.volume != null && Number.isInteger(v.volume) && v.volume >= 1,
    )
    .sort((a, b) => a.volume! - b.volume!);
  if (!numbered.length) return [];
  const picks = [
    numbered[0]!,
    numbered[Math.floor((numbered.length - 1) / 2)]!,
    numbered.at(-1)!,
  ];
  return [...new Set(picks.map((v) => v.title))];
};

const triedAt = new Map<string, number>();
const inFlight = new Map<string, Promise<boolean>>();

// looks again when the saved answer is old (or there is none). Whether a new
// answer was saved. Both sources failing saves nothing: the old answer stays,
// and it's tried again in an hour
export async function scanBoxSets(
  name: string,
  volumes: Pick<CatalogBook, "volume" | "title">[],
): Promise<boolean> {
  const key = setsKey(name);
  const saved = await savedBoxSets(name);
  if (saved && Date.now() - saved.at < FRESH_MS) return false;
  if (Date.now() - (triedAt.get(key) ?? 0) < RETRY_MS) return false;
  const running = inFlight.get(key);
  if (running) return running;
  const titles = sampleTitles(volumes);
  if (!titles.length) return false;
  triedAt.set(key, Date.now());
  if (triedAt.size > 5000) triedAt.delete(triedAt.keys().next().value!);
  const scan = (async () => {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const [ebay, bam] = await Promise.allSettled([
      ebayApiEnabled()
        ? searchEbaySets(titles, signal)
        : Promise.reject(new Error("eBay isn't set up")),
      searchBamSets(
        name.replace(/\s*light novel$/i, ""),
        isNovelName(name),
        signal,
      ),
    ]);
    if (ebay.status === "rejected" && bam.status === "rejected") return false;
    const found = [ebay, bam].flatMap((r) =>
      r.status === "fulfilled" ? r.value : [],
    );
    const sets: ScannedSet[] = found
      .filter((o) => o.inStock && o.format === "set")
      .map((o) => ({
        store: o.store,
        priceCents: o.priceCents,
        url: o.url,
        condition: o.condition,
        format: "set" as const,
      }));
    // a source that failed keeps what it said last time
    const kept = (saved?.sets ?? []).filter(
      (s) =>
        (ebay.status === "rejected" && /^ebay/i.test(s.store)) ||
        (bam.status === "rejected" && /books-a-million/i.test(s.store)),
    );
    await priceQueries.saveSeriesVolumes(key, [
      ...sets,
      ...kept,
    ] as unknown as CatalogBook[]);
    return true;
  })()
    .catch(() => false)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, scan);
  return scan;
}

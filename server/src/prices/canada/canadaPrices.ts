// Canadian prices for one volume, saved in their own tables (priceTables.ts)
// and, like US prices, by source group, each on its own schedule:
//   ebay      eBay.ca, from eBay's own free API (or a SerpApi search without
//             it): looks again after 3 days, and the background job keeps
//             it fresh (collector/filler.ts)
//   shopping  Google Shopping in Canada (Amazon.ca, Indigo and the rest), a
//             paid SerpApi search: looks again after 20 days, and only when
//             someone with Canada picked opens the volume
// A group that answers replaces only its own prices, so an eBay.ca refresh
// keeps Amazon.ca's. Paid searches are capped on their own
// (CANADA_SEARCH_LIMIT a month), so Canada can never use up the searches US
// prices depend on. CANADA_PRICES=off turns it all off.
import { getSeriesWithVolumes, upcomingReleaseOf } from "../service.js";
import { scanIfNeverScanned } from "../boxSetScan.js";
import { seriesOfBook } from "../stores/match.js";
import config from "../../config/config.js";
import priceQueries, { shownOnItsPage } from "../../models/priceQueries.js";
import {
  ebayApiEnabled,
  ebayCallsLeft,
  searchEbay,
} from "../providers/ebay.js";
import { searchSerpApi, serpApiEnabled } from "../providers/serpapiClient.js";
import { shoppingQuery } from "../stores/match.js";
import { dropUnlikelyNew } from "../stores/retailers.js";
import { isWellKnown } from "../volumeNames.js";
import { canadaOfferLink, canadaStoreLinks } from "./canadaLinks.js";
import type { Offer } from "../types.js";
import type { PriceHistory } from "../../models/priceQueries.js";
import {
  believableOffers,
  ebayCaOffers,
  shoppingOffers,
  type CaEbayResult,
  type CaShoppingResult,
} from "./canadaOffers.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const BUDGET_LABEL = "serpapi-ca";

type Group = "ebay" | "shopping";
const GROUPS: Group[] = ["ebay", "shopping"];

// how long a group's look lasts. eBay's own API is free, so it looks every
// few days; through SerpApi, and Google Shopping always, it's a paid search:
// 20 days, or the free allowance runs out in days
const freshFor = (group: Group) =>
  group === "ebay" && ebayApiEnabled() ? 3 * DAY_MS : 20 * DAY_MS;

export type CanadaPrices = {
  // off: switched off; budget: this month's Canadian searches are used up;
  // unknown: a volume we've never seen, so nothing is spent on it;
  // error: the stores didn't answer
  status: "ok" | "off" | "budget" | "unknown" | "error";
  offers: (Offer & { affiliate?: boolean; knownStore?: boolean })[];
  // the oldest of its groups' looks, as the US prices say "checked"
  checkedAt: Date | null;
  // every Canadian price seen for it, like the US page's history
  history: PriceHistory | null;
  // its usual new price in Canada: "most volumes are about"
  usualCents: number | null;
  // each store's own search for the volume, shown whatever the status
  links: { store: string; url: string; affiliate: boolean }[];
};

// a volume's Canadian prices now: each group's from its last look, held to
// the believable-price rule, with their links, its history and when
async function saved(
  isbn13: string,
  status: CanadaPrices["status"] = "ok",
): Promise<CanadaPrices> {
  const [current, usual, checks] = await Promise.all([
    priceQueries.getCurrentOffers(isbn13, "ca"),
    priceQueries.getNewPriceMedian(isbn13, "ca"),
    priceQueries.getSourceChecks(isbn13, "ca"),
  ]);
  const history = await priceQueries.getPriceHistory(isbn13, usual, "ca");
  // only the looks whose prices are still shown on this page (priceAge.ts)
  const times = [...checks.values()]
    .filter((at) => shownOnItsPage(at))
    .map((at) => at.getTime());
  return {
    status,
    offers: dropUnlikelyNew(current, usual).map((o) => ({
      ...o,
      ...canadaOfferLink(o, isbn13),
      knownStore: isWellKnown(o.store),
    })),
    checkedAt: times.length ? new Date(Math.min(...times)) : null,
    history:
      history.checks && history.since && history.lastSeen ? history : null,
    usualCents: usual,
    links: canadaStoreLinks(isbn13),
  };
}

// as long as the US price checks wait for a store
const SEARCH_TIMEOUT_MS = 12_000;

type Searched<T> = { data: T } | "budget" | "failed";

// one search, if this month's Canadian allowance still has one. These come from
// the same SerpApi keys as US prices; CANADA_SEARCH_LIMIT caps Canada's share
const search = async <T extends { error?: string }>(
  params: Record<string, string>,
): Promise<Searched<T>> => {
  if (
    !(await priceQueries.claimApiCall(BUDGET_LABEL, config.CANADA_SEARCH_LIMIT))
  ) {
    return "budget";
  }
  try {
    return {
      data: await searchSerpApi<T>(
        params,
        AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      ),
    };
  } catch (e) {
    console.warn("Canadian price search failed:", (e as Error).message);
    return "failed";
  }
};

type Asked = { offers: Offer[] } | "budget" | "failed";

// eBay.ca: eBay's own free API when it's set up (box sets aren't looked for
// here: the series' scan finds those), else through SerpApi
async function askEbay(
  isbn13: string,
  title: string,
  background: boolean,
): Promise<Asked> {
  // the background never spends a paid search
  if (background && !ebayApiEnabled()) return "budget";
  if (ebayApiEnabled()) {
    if (!(await ebayCallsLeft().catch(() => true))) return "budget";
    return searchEbay(isbn13, title, "CA", AbortSignal.timeout(15_000)).then(
      (offers) => ({ offers }),
      () => "failed" as const,
    );
  }
  const r = await search<{ error?: string; organic_results?: CaEbayResult[] }>({
    engine: "ebay",
    ebay_domain: "ebay.ca",
    _nkw: isbn13,
    _sop: "15",
    buying_format: "BIN",
  });
  return typeof r === "object"
    ? { offers: ebayCaOffers(r.data.organic_results ?? [], title) }
    : r;
}

async function askShopping(title: string): Promise<Asked> {
  const r = await search<{
    error?: string;
    shopping_results?: CaShoppingResult[];
  }>({
    engine: "google_shopping",
    q: shoppingQuery(title),
    gl: "ca",
    hl: "en",
    google_domain: "google.ca",
    location: "Canada",
  });
  return typeof r === "object"
    ? { offers: shoppingOffers(r.data.shopping_results ?? [], title) }
    : r;
}

// which groups can look now: due by their schedule, and able to (Google
// Shopping needs SerpApi; eBay.ca needs eBay's API or SerpApi)
async function dueGroups(isbn13: string, wanted: Group[]) {
  const checks = await priceQueries.getSourceChecks(isbn13, "ca");
  const now = Date.now();
  return wanted.filter((group) => {
    if (group === "shopping" && !serpApiEnabled()) return false;
    if (group === "ebay" && !ebayApiEnabled() && !serpApiEnabled())
      return false;
    const at = checks.get(group);
    return !at || now - at.getTime() >= freshFor(group);
  });
}

// a check already running for a volume: anyone else asking waits for it rather
// than spending the same searches again
const running = new Map<string, Promise<CanadaPrices["status"]>>();

// Looks again with the groups that are due (of `wanted`), saves each that
// answered, and says how it went. Only volumes we know are manga can spend
// anything: a made-up ISBN, or any book someone opened a page for, can't
export function checkCanada(
  isbn13: string,
  wanted: Group[] = GROUPS,
  { background = false } = {},
): Promise<CanadaPrices["status"]> {
  const key = `${isbn13}|${wanted.join(",")}`;
  const already = running.get(key);
  if (already) return already;
  const check = runCheck(isbn13, wanted, background)
    .catch((e: unknown): CanadaPrices["status"] => {
      console.error("Canadian prices failed:", e);
      return "error";
    })
    .finally(() => running.delete(key));
  running.set(key, check);
  return check;
}

async function runCheck(
  isbn13: string,
  wanted: Group[],
  background: boolean,
): Promise<CanadaPrices["status"]> {
  if (config.CANADA_PRICES === "off") return "off";
  const due = await dueGroups(isbn13, wanted);
  if (!due.length) return "ok";
  const book = await priceQueries.getBook(isbn13);
  if (!book || !(await priceQueries.isKnownVolume(isbn13))) return "unknown";

  const answers = await Promise.all(
    due.map((group) =>
      group === "ebay"
        ? askEbay(isbn13, book.title, background)
        : askShopping(book.title),
    ),
  );
  const fresh = new Map<string, Offer[]>();
  answers.forEach((answer, i) => {
    if (typeof answer === "object") fresh.set(due[i]!, answer.offers);
  });
  if (!fresh.size) return answers.includes("failed") ? "error" : "budget";

  // judged with the other groups' current prices, as a US check is: an
  // eBay.ca-only look still drops a "new" copy far above Amazon.ca's
  const [current, usual] = await Promise.all([
    priceQueries.getCurrentRows(isbn13, "ca"),
    priceQueries.getNewPriceMedian(isbn13, "ca"),
  ]);
  const kept = current.filter((o) => !fresh.has(o.source));
  const judged = new Map<string, Offer[]>();
  for (const [group, offers] of fresh) {
    const believed = new Set(believableOffers([...offers, ...kept], usual));
    judged.set(
      group,
      offers.filter((o) => believed.has(o)),
    );
  }
  const sources = [...judged.keys()].map((group) =>
    group === "ebay" ? "ebay.ca" : "google.ca",
  );
  await priceQueries.saveCheck(
    isbn13,
    background ? [...sources, "fill"] : sources,
    judged,
    "ca",
  );
  return "ok";
}

async function scanCanadaSetsOnce(isbn13: string) {
  const book = await priceQueries.getBook(isbn13).catch(() => null);
  if (!book) return;
  const series = await getSeriesWithVolumes(seriesOfBook(book.title)).catch(
    () => null,
  );
  if (series?.volumes.length)
    await scanIfNeverScanned(series.name, series.volumes, "ca");
}

// What a Canadian volume page shows. refresh false: saved prices only, for
// crawlers, which never spend searches. Not out yet (a preorder): eBay.ca
// only, never a paid search
export async function getCanadaPrices(
  isbn13: string,
  { refresh = true } = {},
): Promise<CanadaPrices> {
  if (!refresh) return saved(isbn13);
  const preorder = await upcomingReleaseOf(isbn13);
  // its series' eBay.ca box sets, if nobody has looked for them yet
  if (!preorder) void scanCanadaSetsOnce(isbn13);
  const status = await checkCanada(isbn13, preorder ? ["ebay"] : GROUPS);
  const now = await saved(isbn13);
  // what's saved is shown whatever the check said; the status only explains
  // an empty list
  return now.offers.length || status === "ok" ? now : { ...now, status };
}

// Canadian prices for one volume: checked only when someone with Canada picked
// opens it, saved in their own tables, and reused for two days. Searches are
// capped on their own (CANADA_SEARCH_LIMIT a month), so Canada can never use up
// the searches US prices depend on. CANADA_PRICES=off turns it all off.
import config from "../../config/config.js";
import { prisma } from "../../config/prisma.js";
import priceQueries from "../../models/priceQueries.js";
import { searchSerpApi, serpApiEnabled } from "../providers/serpapiClient.js";
import { ebayCampaignId } from "../affiliates.js";
import type { Offer } from "../types.js";
import {
  believableOffers,
  ebayCaOffers,
  shoppingOffers,
  type CaEbayResult,
  type CaShoppingResult,
} from "./canadaOffers.js";

const FRESH_FOR_MS = 2 * 24 * 60 * 60 * 1000;
const BUDGET_LABEL = "serpapi-ca";

export type CanadaPrices = {
  // off: switched off; budget: this month's Canadian searches are used up;
  // unknown: a volume we've never seen, so nothing is spent on it;
  // error: the stores didn't answer
  status: "ok" | "off" | "budget" | "unknown" | "error";
  offers: Offer[];
  checkedAt: Date | null;
  // each store's own search for the volume, shown whatever the status
  links: { store: string; url: string; affiliate: boolean }[];
};

// eBay Partner Network for ebay.ca: the same campaign as the US links, with
// eBay Canada's own codes (mkrid 706-53473-19255-0, siteid 2), per EPN's generator
const ebayCa = (url: string, source: string) => {
  const campid = ebayCampaignId();
  if (!campid) return url;
  const link = new URL(url);
  link.searchParams.set("mkcid", "1");
  link.searchParams.set("mkrid", "706-53473-19255-0");
  link.searchParams.set("siteid", "2");
  link.searchParams.set("campid", campid);
  link.searchParams.set("customid", source);
  link.searchParams.set("toolid", "10001");
  link.searchParams.set("mkevt", "1");
  return link.toString();
};

// Amazon.ca with our Associates tag when there is one
const amazonCa = (isbn13: string) => {
  const tag = config.CANADA_AMAZON_AFFILIATE;
  return `https://www.amazon.ca/s?k=${isbn13}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`;
};

export const canadaStoreLinks = (isbn13: string) => [
  {
    store: "Amazon.ca",
    url: amazonCa(isbn13),
    affiliate: Boolean(config.CANADA_AMAZON_AFFILIATE),
  },
  {
    store: "Indigo",
    url: `https://www.indigo.ca/search?q=${isbn13}`,
    affiliate: false,
  },
  {
    store: "eBay.ca",
    url: ebayCa(`https://www.ebay.ca/sch/i.html?_nkw=${isbn13}`, "ca-search"),
    affiliate: Boolean(ebayCampaignId()),
  },
  {
    store: "Walmart.ca",
    url: `https://www.walmart.ca/search?q=${isbn13}`,
    affiliate: false,
  },
];

// Amazon.ca's row goes to Amazon.ca itself, with the tag, rather than through
// Google; eBay.ca's rows get eBay Canada's tracking
const withLinks = (
  isbn13: string,
  result: Omit<CanadaPrices, "links">,
): CanadaPrices => ({
  ...result,
  offers: result.offers.map((o) =>
    o.store === "Amazon.ca"
      ? {
          ...o,
          url: amazonCa(isbn13),
          affiliate: Boolean(config.CANADA_AMAZON_AFFILIATE),
        }
      : o.store === "eBay.ca" && o.url
        ? {
            ...o,
            url: ebayCa(o.url, "ca-listing"),
            affiliate: Boolean(ebayCampaignId()),
          }
        : o,
  ),
  links: canadaStoreLinks(isbn13),
});

const latest = async (isbn13: string, checkedAt: Date) => {
  const rows = await prisma.caPriceSample.findMany({
    where: { isbn13, fetchedAt: checkedAt },
    orderBy: { priceCents: "asc" },
  });
  return rows.map(
    ({ store, format, condition, priceCents, currency, inStock, url }) => ({
      store,
      format,
      condition,
      priceCents,
      currency,
      inStock,
      url,
    }),
  );
};

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

// a check already running for a volume: anyone else asking waits for it rather
// than spending the same searches again
const running = new Map<string, Promise<CanadaPrices>>();

// refresh false: saved prices only, for crawlers, which never spend searches
export function getCanadaPrices(
  isbn13: string,
  { refresh = true } = {},
): Promise<CanadaPrices> {
  if (!refresh)
    return savedOnly(isbn13).then((result) => withLinks(isbn13, result));
  const already = running.get(isbn13);
  if (already) return already;
  // never throws: whatever happens, they still get the store links
  const check = checkCanadaPrices(isbn13)
    .catch((e: unknown): Omit<CanadaPrices, "links"> => {
      console.error("Canadian prices failed:", e);
      return { status: "error", offers: [], checkedAt: null };
    })
    .then((result) => withLinks(isbn13, result))
    .finally(() => running.delete(isbn13));
  running.set(isbn13, check);
  return check;
}

async function savedOnly(isbn13: string): Promise<Omit<CanadaPrices, "links">> {
  const last = await prisma.caPriceCheck.findUnique({ where: { isbn13 } });
  return last
    ? {
        status: "ok",
        offers: await latest(isbn13, last.checkedAt),
        checkedAt: last.checkedAt,
      }
    : { status: "ok", offers: [], checkedAt: null };
}

async function checkCanadaPrices(
  isbn13: string,
): Promise<Omit<CanadaPrices, "links">> {
  if (config.CANADA_PRICES === "off" || !serpApiEnabled()) {
    return { status: "off", offers: [], checkedAt: null };
  }
  const last = await prisma.caPriceCheck.findUnique({ where: { isbn13 } });
  if (last && Date.now() - last.checkedAt.getTime() < FRESH_FOR_MS) {
    return {
      status: "ok",
      offers: await latest(isbn13, last.checkedAt),
      checkedAt: last.checkedAt,
    };
  }

  // only volumes we already know: a made-up ISBN can't spend anything
  const book = await priceQueries.getBook(isbn13);
  if (!book) return { status: "unknown", offers: [], checkedAt: null };
  const title = book.title;
  const saved = async (): Promise<Omit<CanadaPrices, "links"> | null> =>
    last
      ? {
          status: "ok",
          offers: await latest(isbn13, last.checkedAt),
          checkedAt: last.checkedAt,
        }
      : null;

  const [shopping, ebay] = await Promise.all([
    search<{ error?: string; shopping_results?: CaShoppingResult[] }>({
      engine: "google_shopping",
      q: `${title} manga`,
      gl: "ca",
      hl: "en",
      google_domain: "google.ca",
      location: "Canada",
    }),
    search<{ error?: string; organic_results?: CaEbayResult[] }>({
      engine: "ebay",
      ebay_domain: "ebay.ca",
      _nkw: isbn13,
      _sop: "15",
      buying_format: "BIN",
    }),
  ]);
  // only a check where every store answered is saved: a half one would hide
  // stores for two days. The last full check stays up meanwhile
  const answered = [shopping, ebay].filter((r) => typeof r === "object");
  if (answered.length < 2) {
    const fallback = await saved();
    if (fallback) return fallback;
    if (!answered.length) {
      return {
        status: shopping === "failed" || ebay === "failed" ? "error" : "budget",
        offers: [],
        checkedAt: null,
      };
    }
    // nothing saved yet: show what did come back, without keeping it
    return {
      status: "ok",
      offers: believableOffers([
        ...shoppingOffers(
          typeof shopping === "object"
            ? (shopping.data.shopping_results ?? [])
            : [],
          title,
        ),
        ...ebayCaOffers(
          typeof ebay === "object" ? (ebay.data.organic_results ?? []) : [],
          title,
        ),
      ]),
      checkedAt: null,
    };
  }

  const shoppingData = (
    shopping as { data: { shopping_results?: CaShoppingResult[] } }
  ).data;
  const ebayData = (ebay as { data: { organic_results?: CaEbayResult[] } })
    .data;
  const offers = believableOffers([
    ...shoppingOffers(shoppingData.shopping_results ?? [], title),
    ...ebayCaOffers(ebayData.organic_results ?? [], title),
  ]);
  const at = new Date();
  await prisma.$transaction([
    prisma.caPriceCheck.upsert({
      where: { isbn13 },
      create: { isbn13, checkedAt: at, sources: ["google.ca", "ebay.ca"] },
      update: { checkedAt: at },
    }),
    prisma.caPriceSample.createMany({
      data: offers.map((o) => ({ ...o, isbn13, fetchedAt: at })),
    }),
  ]);
  return { status: "ok", offers, checkedAt: at };
}

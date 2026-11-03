// Canadian prices for one volume: checked only when someone with Canada picked
// opens it, saved in their own tables, and reused for two days. Searches are
// capped on their own (CANADA_SEARCH_LIMIT a month), so Canada can never use up
// the searches US prices depend on. CANADA_PRICES=off turns it all off.
import config from "../../config/config.js";
import { prisma } from "../../config/prisma.js";
import priceQueries from "../../models/priceQueries.js";
import { searchSerpApi, serpApiEnabled } from "../providers/serpapiClient.js";
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
  // off: switched off; budget: this month's Canadian searches are used up
  status: "ok" | "off" | "budget";
  offers: Offer[];
  checkedAt: Date | null;
  // each store's own search for the volume, shown whatever the status
  links: { store: string; url: string; affiliate: boolean }[];
};

// Amazon.ca with our Associates tag when there is one
const amazonCa = (isbn13: string) => {
  const tag = config.CANADA_AMAZON_AFFILIATE;
  return `https://www.amazon.ca/s?k=${isbn13}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`;
};

const storeLinks = (isbn13: string) => [
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
    url: `https://www.ebay.ca/sch/i.html?_nkw=${isbn13}`,
    affiliate: false,
  },
  {
    store: "Walmart.ca",
    url: `https://www.walmart.ca/search?q=${isbn13}`,
    affiliate: false,
  },
];

// Amazon.ca's row goes to Amazon.ca itself, with the tag, rather than through Google
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
      : o,
  ),
  links: storeLinks(isbn13),
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

// one search, if this month's Canadian allowance still has one
const search = async <T extends { error?: string }>(
  params: Record<string, string>,
) => {
  if (
    !(await priceQueries.claimApiCall(BUDGET_LABEL, config.CANADA_SEARCH_LIMIT))
  )
    return null;
  return searchSerpApi<T>(params, new AbortController().signal);
};

// a check already running for a volume: anyone else asking waits for it rather
// than spending the same searches again
const running = new Map<string, Promise<CanadaPrices>>();

export function getCanadaPrices(isbn13: string): Promise<CanadaPrices> {
  const already = running.get(isbn13);
  if (already) return already;
  const check = checkCanadaPrices(isbn13)
    .then((result) => withLinks(isbn13, result))
    .finally(() => running.delete(isbn13));
  running.set(isbn13, check);
  return check;
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

  const book = await priceQueries.getBook(isbn13);
  const title = book?.title ?? "";
  const [shopping, ebay] = await Promise.all([
    title
      ? search<{ error?: string; shopping_results?: CaShoppingResult[] }>({
          engine: "google_shopping",
          q: `${title} manga`,
          gl: "ca",
          hl: "en",
          google_domain: "google.ca",
          location: "Canada",
        }).catch(() => null)
      : null,
    search<{ error?: string; organic_results?: CaEbayResult[] }>({
      engine: "ebay",
      ebay_domain: "ebay.ca",
      _nkw: isbn13,
      _sop: "15",
      buying_format: "BIN",
    }).catch(() => null),
  ]);
  // nothing could be asked: the month's Canadian searches are used up
  if (!shopping && !ebay) {
    if (last) {
      return {
        status: "ok",
        offers: await latest(isbn13, last.checkedAt),
        checkedAt: last.checkedAt,
      };
    }
    return { status: "budget", offers: [], checkedAt: null };
  }

  const offers = believableOffers([
    ...shoppingOffers(shopping?.shopping_results ?? [], title),
    ...ebayCaOffers(ebay?.organic_results ?? [], title),
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

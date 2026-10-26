import priceQueries from "../models/priceQueries.js";
import { lookupIsbn } from "./catalog.js";
import { enabledProviders } from "./providers/index.js";
import { storeLinks } from "./storeLinks.js";

// prices are re-fetched at most this often per volume; in between, people
// see the stored ones. Keeps us well inside every API's rate limits
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 8000;

// one fetch per ISBN at a time, even if several people open it at once
const inFlight = new Map();

// providers get the stored book too, for sources that search by title
async function fetchAllProviders(isbn13, book) {
  const providers = enabledProviders();
  const results = await Promise.allSettled(
    providers.map((p) =>
      p.fetchOffers(isbn13, AbortSignal.timeout(PROVIDER_TIMEOUT_MS), book),
    ),
  );

  const offers = [];
  const sources = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sources.push(providers[i].id);
      offers.push(...r.value);
    } else {
      console.error(`price provider ${providers[i].id} failed:`, r.reason);
    }
  });

  // only record a check if at least one source answered, so an outage
  // doesn't leave a volume looking "checked, nothing found" for six hours
  if (providers.length && sources.length) {
    await priceQueries.saveCheck(isbn13, sources, offers);
  }
  return { sources, attempted: providers.length };
}

async function refreshIfStale(isbn13, book) {
  const last = await priceQueries.getLastCheck(isbn13);
  const fresh =
    last && Date.now() - new Date(last.checked_at).getTime() < FRESH_FOR_MS;
  if (fresh || !enabledProviders().length) return;

  if (!inFlight.has(isbn13)) {
    inFlight.set(
      isbn13,
      fetchAllProviders(isbn13, book).finally(() => inFlight.delete(isbn13)),
    );
  }
  await inFlight.get(isbn13);
}

async function getOrCreateBook(isbn13) {
  const stored = await priceQueries.getBook(isbn13);
  if (stored) return stored;
  const found = await lookupIsbn(isbn13);
  if (!found) return null;
  await priceQueries.upsertBook(found);
  return priceQueries.getBook(isbn13);
}

export async function getVolumePrices(isbn13) {
  const book = await getOrCreateBook(isbn13);
  if (!book) return null;

  await refreshIfStale(isbn13, book);

  const last = await priceQueries.getLastCheck(isbn13);
  // a check and its samples share one transaction, so they share now()
  const [offers, stats] = await Promise.all([
    last ? priceQueries.getLatestOffers(isbn13, last.checked_at) : [],
    priceQueries.getPriceStats(isbn13),
  ]);

  return {
    book: {
      isbn13: book.isbn13,
      title: book.title,
      authors: book.authors,
      publisher: book.publisher,
      coverUrl: book.cover_url,
      year: book.year,
    },
    offers: offers.map((o) => ({
      store: o.store,
      format: o.format,
      condition: o.condition,
      priceCents: o.price_cents,
      currency: o.currency,
      inStock: o.in_stock,
      url: o.url,
      fetchedAt: o.fetched_at,
    })),
    stats: stats.samples
      ? {
          samples: stats.samples,
          lowCents: stats.low_cents,
          highCents: stats.high_cents,
          avgCents: stats.avg_cents,
          since: stats.since,
        }
      : null,
    checkedAt: last?.checked_at ?? null,
    liveSources: enabledProviders().map((p) => p.store),
    storeLinks: storeLinks(isbn13),
  };
}

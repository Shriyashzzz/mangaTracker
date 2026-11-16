// The sitemap's volumes (models/coversAndSitemap.ts getSitemapEntries): only
// volumes whose page still shows prices, so search engines' visits go to
// pages worth indexing. No price search is made here.
import { getSitemapEntries } from "../../models/coversAndSitemap.js";
import { closeDb, prisma } from "./testDb.js";

const FRESH = "9781999999986";
const STALE = "9781999999979";
const removeBooks = () =>
  prisma.book.deleteMany({ where: { isbn13: { in: [FRESH, STALE] } } });

beforeEach(removeBooks);
afterAll(async () => {
  await removeBooks();
  await closeDb();
});

const DAY_MS = 86_400_000;

// a volume priced by eBay `days` ago: its check and the sample it found
async function pricedAgo(isbn13: string, days: number, now: number) {
  const at = new Date(now - days * DAY_MS);
  await prisma.book.create({
    data: { isbn13, title: `Zz Sitemap Series, Vol. ${days}` },
  });
  await prisma.priceSourceCheck.create({
    data: { isbn13, source: "ebay", checkedAt: at },
  });
  await prisma.priceSample.create({
    data: {
      isbn13,
      store: "eBay",
      priceCents: 999,
      source: "ebay",
      fetchedAt: at,
    },
  });
}

test("a volume is listed only while its page still shows a price", async () => {
  const now = Date.now();
  await pricedAgo(FRESH, 10, now);
  await pricedAgo(STALE, 120, now);
  const listed = (await getSitemapEntries(now)).volumes.map((v) =>
    v.isbn13.trim(),
  );
  expect(listed).toContain(FRESH);
  expect(listed).not.toContain(STALE);
});

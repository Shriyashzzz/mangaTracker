// Asks eBay again about volumes whose saved eBay prices include a "box set"
// or "omnibus" row from before the rules for telling those apart were fixed
// (2026-11-09 to 13). A saved row keeps the label it was given: an omnibus
// saved as a box set ("Bleach: Omnibus Vol 1 (Vols 1-3)" for $15) stays one
// on the series' page until eBay looks at that volume again, and the
// background's pace can leave that for weeks. A listing's title isn't kept,
// so the row can't be re-read here: eBay has to be asked.
//
//   npx tsx scripts/recheckEbaySets.ts                      dry run: what would be asked
//   npx tsx scripts/recheckEbaySets.ts --apply              ask eBay, replace those prices
//   npx tsx scripts/recheckEbaySets.ts --before 2026-11-13  only rows saved before that day (the default)
//
// It runs the same eBay-only check the background does (three eBay calls a
// volume, from the day's allowance), so nothing but those volumes' eBay
// prices changes, and it stops when eBay's allowance for the day is gone.
// The database is DATABASE_URL (server/.env, or set on the command line).
import { prisma } from "../src/config/prisma.js";
import priceQueries from "../src/models/priceQueries.js";
import ebay, { ebayCallsLeft } from "../src/prices/providers/ebay.js";
import { fetchProviders, getOrCreateBook } from "../src/prices/service.js";

const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const apply = process.argv.includes("--apply");
const before = new Date(arg("before") ?? "2026-11-13");

// a volume's eBay rows now, as "set $15.00, print $7.00"
async function ebayRows(isbn13: string) {
  const offers = await priceQueries.getCurrentOffers(isbn13);
  return (
    offers
      .filter((o) => /^ebay/i.test(o.store))
      .map((o) => `${o.format} $${(o.priceCents / 100).toFixed(2)}`)
      .join(", ") || "none"
  );
}

async function main() {
  if (Number.isNaN(before.getTime())) throw new Error("--before isn't a date");
  // volumes whose eBay prices now (the rows of eBay's last look) include a
  // set or an omnibus saved before the day given
  const waiting = await prisma.$queryRaw<{ isbn13: string; title: string }[]>`
    SELECT DISTINCT s.isbn13, b.title
    FROM price_samples s
    JOIN price_source_checks c
      ON c.isbn13 = s.isbn13 AND c.source = s.source AND c.checked_at = s.fetched_at
    JOIN books b ON b.isbn13 = s.isbn13
    WHERE s.source = 'ebay' AND s.format IN ('set', 'omnibus')
      AND s.fetched_at < ${before}
    ORDER BY b.title
  `;
  console.log(
    `${apply ? "ASKING EBAY" : "DRY RUN"}: ${waiting.length} volumes with an eBay set or omnibus row saved before ${before.toISOString().slice(0, 10)}\n`,
  );
  if (!ebay.enabled()) throw new Error("eBay's keys aren't set");

  let asked = 0;
  for (const { isbn13, title } of waiting) {
    const isbn = isbn13.trim();
    const was = await ebayRows(isbn);
    if (!apply) {
      console.log(`${title} (${isbn}): ${was}`);
      continue;
    }
    if (!(await ebayCallsLeft())) {
      console.log(
        "\neBay's allowance for today is used up: run it again tomorrow",
      );
      break;
    }
    const book = await getOrCreateBook(isbn);
    if (!book) continue;
    await fetchProviders(isbn, book, [ebay], { background: true });
    asked++;
    console.log(`${title} (${isbn}): ${was}  ->  ${await ebayRows(isbn)}`);
  }
  console.log(
    apply
      ? `\nasked eBay about ${asked} of ${waiting.length} volumes`
      : "\nnothing changed: add --apply to ask eBay",
  );
}

main()
  .catch((e: Error) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

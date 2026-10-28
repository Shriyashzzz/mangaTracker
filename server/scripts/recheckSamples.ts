// Re-judges stored price samples with today's rules in src/prices/retailers.ts,
// so listings that were wrongly counted as new copies (a $4 "new" Dandadan
// from a cosmetics shop) stop shaping the price history.
//
//   npx tsx scripts/recheckSamples.ts --db <url>            dry run
//   npx tsx scripts/recheckSamples.ts --db <url> --apply    write
//   --db can be left out: it defaults to DATABASE_URL in server/.env
//
// For each check (one volume, one fetch time) it moves resale-site listings
// that were stored as new to marketplace, and deletes samples the price
// checker would now drop: unbelievable new copies, and sellers that aren't
// English printed books (audiobooks, Japanese imports).
// Everything happens in one transaction; running it twice changes nothing.
import "dotenv/config";
import { Client } from "pg";
import { isNotABook, isResaleSite, unlikelyNewTest } from "../src/prices/retailers.js";
import type { Offer } from "../src/prices/types.js";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const url = arg("db") ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply");
if (!url) {
  console.error("usage: --db <database url> [--apply]");
  process.exit(1);
}

type Sample = Offer & { id: string; isbn13: string; fetchedAt: Date };

const db = new Client({ connectionString: url, options: "-c timezone=UTC" });

async function main() {
  await db.connect();
  console.log(`${apply ? "FIXING" : "DRY RUN"}: ${new URL(url!).host}\n`);

  const { rows } = await db.query<Sample>(`
    SELECT id, isbn13, store, format, condition, price_cents AS "priceCents",
           currency, in_stock AS "inStock", url, fetched_at AS "fetchedAt"
    FROM price_samples ORDER BY isbn13, fetched_at
  `);

  const checks = new Map<string, Sample[]>();
  for (const s of rows) {
    const k = `${s.isbn13}|${s.fetchedAt.toISOString()}`;
    checks.set(k, [...(checks.get(k) ?? []), s]);
  }

  const toMarketplace: Sample[] = [];
  const toDelete: Sample[] = [];
  for (const samples of checks.values()) {
    toDelete.push(...samples.filter((s) => isNotABook(s.store)));
    const books = samples.filter((s) => !isNotABook(s.store));
    // resale sites first, then the price test over what's left as new
    const resale = books.filter((s) => s.condition === "new" && isResaleSite(s.store));
    const rest = books.filter((s) => !resale.includes(s));
    toMarketplace.push(...resale);
    toDelete.push(...rest.filter(unlikelyNewTest(rest)));
  }

  const show = (s: Sample) =>
    `  ${s.isbn13}  ${s.fetchedAt.toISOString().slice(0, 10)}  $${(s.priceCents / 100).toFixed(2).padStart(6)}  ${s.store}`;
  console.log(`new -> marketplace: ${toMarketplace.length}`);
  toMarketplace.forEach((s) => console.log(show(s)));
  console.log(`\ndeleted (unbelievable new copy, or not an English print book): ${toDelete.length}`);
  toDelete.forEach((s) => console.log(show(s)));

  if (!apply) {
    console.log("\nNothing written. Add --apply to fix.");
    return;
  }
  await db.query("BEGIN");
  try {
    if (toMarketplace.length) {
      await db.query(
        "UPDATE price_samples SET condition = 'marketplace' WHERE id = ANY($1::bigint[])",
        [toMarketplace.map((s) => s.id)],
      );
    }
    if (toDelete.length) {
      await db.query("DELETE FROM price_samples WHERE id = ANY($1::bigint[])", [
        toDelete.map((s) => s.id),
      ]);
    }
    await db.query("COMMIT");
    console.log("\nDone.");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());

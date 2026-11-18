// Stored books saved before an edition's book was read from its own catalog
// record keep the bare title a search gave them: "Monster" for Monster: The
// Perfect Edition, Vol. 1, or "Dragon Ball Z, Vol. 1" for the VIZBIG. Their
// price pages then don't know their edition. This asks the catalog (free)
// about each stored book again, the way a new lookup now does
// (src/prices/sources/catalog.ts lookupIsbn), and renames the ones whose
// title gains an edition or a volume number. Prices, checks and history stay
// with the ISBN, so nothing else changes.
//
//   npx tsx scripts/retitleEditions.ts --db <url>            dry run
//   npx tsx scripts/retitleEditions.ts --db <url> --apply    write
//   --db can be left out: it defaults to DATABASE_URL in server/.env
//   --limit 500   stop after that many books (the rest another day)
//
// Running it twice changes nothing. A book the catalog couldn't answer for
// is left as it is. It asks Open Library once or twice a book, a second
// apart, and Google Books only for a book as long as three volumes that Open
// Library names no edition for (those count against the day's 1,000).
import "dotenv/config";
import { Client } from "pg";
import { lookupIsbn } from "../src/prices/sources/catalog.js";
import { editionOfTitle } from "../src/prices/stores/match.js";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const url = arg("db") ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply");
const limit = Number(arg("limit")) || Infinity;
if (!url) {
  console.error("usage: --db <database url> [--apply] [--limit n]");
  process.exit(1);
}

const db = new Client({ connectionString: url });
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

// whether the catalog's title says more about which book this is: it names
// an edition the stored one doesn't, or a number the stored one lacks
const saysMore = (found: string, stored: string) =>
  (editionOfTitle(found) !== null && editionOfTitle(stored) === null) ||
  (/\d/.test(found) && !/\d/.test(stored));

async function main() {
  await db.connect();
  console.log(`${apply ? "FIXING" : "DRY RUN"}: ${new URL(url!).host}\n`);
  const { rows } = await db.query<{ isbn13: string; title: string }>(
    "SELECT isbn13, title FROM books ORDER BY isbn13",
  );
  let renamed = 0;
  let unanswered = 0;
  let checked = 0;
  for (const row of rows) {
    if (checked >= limit) break;
    // one that names its edition already has nothing to gain
    if (editionOfTitle(row.title)) continue;
    checked++;
    const found = await lookupIsbn(row.isbn13.trim()).catch(() => undefined);
    if (found === undefined) unanswered++;
    if (
      found &&
      found.title !== row.title &&
      saysMore(found.title, row.title)
    ) {
      renamed++;
      console.log(`  ${row.isbn13.trim()}  "${row.title}" -> "${found.title}"`);
      if (apply)
        await db.query("UPDATE books SET title = $1 WHERE isbn13 = $2", [
          found.title,
          row.isbn13,
        ]);
    }
    if (checked % 50 === 0) console.log(`  … ${checked} checked`);
    // Open Library is shared and free: one book at a time, a second apart
    await sleep(1000);
  }
  console.log(
    `\n${rows.length} books, ${checked} asked about, ${renamed} ${apply ? "renamed" : "to rename"}, ${unanswered} the catalog couldn't answer for (run again later).`,
  );
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

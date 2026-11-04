// Stored volumes saved before light novels were told apart from manga can be a
// novel under the manga's name: "Overlord, Vol. 2" for the novel's ISBN, which
// then counts as the manga's on shelf prices and the series page. This asks
// Open Library (free) about each stored book again and, where it's really the
// novel, renames it the way the price checker names novels now
// ("Overlord Light Novel, Vol. 2"; see src/prices/lightNovel.ts). Prices,
// checks and history stay with the ISBN, so nothing else changes.
//
//   npx tsx scripts/retitleNovels.ts --db <url>            dry run
//   npx tsx scripts/retitleNovels.ts --db <url> --apply    write
//   --db can be left out: it defaults to DATABASE_URL in server/.env
//
// Running it twice changes nothing. Only manga -> novel renames are made: a
// book Open Library couldn't answer for is left as it is.
import "dotenv/config";
import { Client } from "pg";
import { lookupIsbn } from "../src/prices/sources/catalog.js";
import { isNovelBook } from "../src/prices/stores/match.js";

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

const db = new Client({ connectionString: url });

async function main() {
  await db.connect();
  console.log(`${apply ? "FIXING" : "DRY RUN"}: ${new URL(url!).host}\n`);
  const { rows } = await db.query<{ isbn13: string; title: string }>(
    "SELECT isbn13, title FROM books ORDER BY isbn13",
  );
  let renamed = 0;
  let unanswered = 0;
  for (const [i, row] of rows.entries()) {
    if (isNovelBook(row.title)) continue;
    // Open Library is shared and free: one question at a time
    const found = await lookupIsbn(row.isbn13.trim()).catch(() => undefined);
    if (found === undefined) unanswered++;
    if (found && isNovelBook(found.title)) {
      renamed++;
      console.log(`  ${row.isbn13.trim()}  "${row.title}" -> "${found.title}"`);
      if (apply) {
        await db.query("UPDATE books SET title = $1 WHERE isbn13 = $2", [
          found.title,
          row.isbn13,
        ]);
      }
    }
    if ((i + 1) % 50 === 0) console.log(`  … ${i + 1} of ${rows.length} checked`);
  }
  console.log(
    `\n${rows.length} books, ${renamed} ${apply ? "renamed" : "to rename"}, ${unanswered} Open Library couldn't answer for (run again later for those)`,
  );
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  await db.end().catch(() => {});
  process.exit(1);
});

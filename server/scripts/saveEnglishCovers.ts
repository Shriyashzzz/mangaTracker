// A series' cover is its English one only where we know its first US volume
// (src/prices/sources/englishCover.ts). That's known once the series'
// volume list is saved, which normally happens the first time someone opens
// its price page. This saves the list for every series that has none yet,
// so their covers turn English without waiting for a visitor.
//
// It asks Open Library (free) what a visit would ask, one series at a time
// with a pause between, so a few hundred series take an hour or more. No
// store is asked for a price.
//
//   npx tsx scripts/saveEnglishCovers.ts                     dry run: counts
//   npx tsx scripts/saveEnglishCovers.ts --apply             look up and save
//   npx tsx scripts/saveEnglishCovers.ts --apply --limit 50  only the first 50
//   --db <url>  another database (production); defaults to DATABASE_URL in
//               server/.env
//
// Safe to stop and run again: a series whose list is saved is skipped. If
// Open Library asks us to slow down several times in a row it stops; run it
// again later and it carries on from there.
import "dotenv/config";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
// set before the app's own code loads: it reads the address once, on import
const db = arg("db");
if (db) process.env.DATABASE_URL = db;
const apply = process.argv.includes("--apply");
const limit = Number(arg("limit")) || Infinity;

const PAUSE_MS = 3_000;
// after an unfinished answer (Open Library busy): wait this long
const BUSY_PAUSE_MS = 60_000;
const BUSY_IN_A_ROW_MAX = 5;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function main() {
  const { default: priceQueries } =
    await import("../src/models/priceQueries.js");
  const { listKnownSeries } = await import("../src/prices/sources/anilist.js");
  const { englishCoverIsbn } =
    await import("../src/prices/sources/englishCover.js");
  const { seriesVolumes } = await import("../src/prices/seriesService.js");
  const { volumesKey } = await import("../src/prices/volumesKey.js");

  console.log(
    `${apply ? "SAVING" : "DRY RUN"}: ${new URL(process.env.DATABASE_URL!).host}\n`,
  );
  const series = await listKnownSeries();
  // the ones with no saved list: looked up never, or before lists were kept
  const missing: string[] = [];
  let english = 0;
  for (const { name } of series) {
    if (await englishCoverIsbn(name)) english++;
    const saved = await priceQueries.getSeriesVolumes(volumesKey(name));
    if (!saved) missing.push(name);
  }
  console.log(`${series.length} series`);
  console.log(`${english} already have an English cover`);
  console.log(`${missing.length} have no saved volume list\n`);
  if (!apply) {
    console.log("Nothing looked up. Add --apply to save their lists.");
    return;
  }

  const todo = missing.slice(0, limit);
  let found = 0;
  let busyInARow = 0;
  for (const [i, name] of todo.entries()) {
    const { volumes, incomplete } = await seriesVolumes(name).catch(
      (e: Error) => {
        console.log(`  ! ${name}: ${e.message}`);
        return { volumes: [], incomplete: true };
      },
    );
    const hasFirst = volumes.some((v) => v.volume === 1 && !v.inBook);
    if (hasFirst) found++;
    console.log(
      `  ${i + 1}/${todo.length}  ${name}: ${volumes.length} volumes${hasFirst ? "" : ", no vol. 1"}${incomplete ? " (unfinished, not saved)" : ""}`,
    );
    busyInARow = incomplete ? busyInARow + 1 : 0;
    if (busyInARow >= BUSY_IN_A_ROW_MAX) {
      console.log("\nOpen Library is busy. Stopped; run it again later.");
      break;
    }
    await sleep(incomplete ? BUSY_PAUSE_MS : PAUSE_MS);
  }
  console.log(`\n${found} more series now have an English cover.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  // the app's database pool would keep the script open
  .finally(() => process.exit());

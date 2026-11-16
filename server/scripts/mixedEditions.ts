// Finished series whose English volume list runs well past AniList's count:
// the likely mix of two editions numbered their own ways, as Sailor Moon was
// (Kodansha's 12 and Mixx's run to 18). Read only, from the database: no
// lookups, nothing written.
//
// Each one is checked by hand against the publisher's own site, and a
// confirmed reissue goes in src/prices/reissue.ts REISSUES (its names, how
// many volumes the edition sold today has, and that publisher's ISBN starts).
//
//   npx tsx scripts/mixedEditions.ts            against the database in .env
//   npx tsx scripts/mixedEditions.ts --db <url>  against another (production)
import "dotenv/config";
import { finalKey } from "../src/prices/seriesCache.js";
import { isNovelName } from "../src/prices/lightNovel.js";
import type { CatalogBook, SeriesInfo } from "../src/prices/types.js";

// pointed at another database before the connection is made
const at = process.argv.indexOf("--db");
if (at >= 0 && process.argv[at + 1])
  process.env.DATABASE_URL = process.argv[at + 1];
const { pool, prisma } = await import("../src/config/prisma.js");

// one or two past the end are strays (an art book, a box set), which the
// series page drops on its own: a run of this many is another numbering
const PAST_THE_END = 3;

const rows = await prisma.seriesInfo.findMany({
  select: { info: true },
});
const finished = rows
  .map((row) => row.info as SeriesInfo | null)
  .filter(
    (info): info is SeriesInfo & { volumes: number } =>
      info?.status === "FINISHED" &&
      Boolean(info.volumes) &&
      Boolean(info.name),
  );

const found: string[] = [];
// a series saved under more than one row is checked once
const seen = new Set<string>();
for (const info of finished) {
  if (seen.has(info.name)) continue;
  // a light novel's English count is its own, never AniList's manga's
  if (isNovelName(info.name)) continue;
  seen.add(info.name);
  const saved = await prisma.seriesVolumes.findUnique({
    where: { key: finalKey(info.name) },
  });
  const volumes = ((saved?.volumes ?? []) as CatalogBook[]).filter(
    (v) => v.volume != null && !v.inBook && Number.isInteger(v.volume),
  );
  const past = volumes.filter((v) => v.volume! > info.volumes);
  if (past.length < PAST_THE_END) continue;
  const highest = Math.max(...volumes.map((v) => v.volume!));
  // the publishers' ISBN blocks in the list: two or more is the giveaway
  const blocks = [...new Set(volumes.map((v) => v.isbn13.trim().slice(0, 9)))];
  found.push(
    `${info.name}\n  AniList ${info.volumes} · listed to vol. ${highest} (${past.length} past the end) · ISBN blocks ${blocks.join(", ")}`,
  );
}

console.log(
  found.length
    ? `${found.length} to check by hand:\n\n${found.join("\n\n")}`
    : `Nothing to check: no finished series runs ${PAST_THE_END}+ volumes past its count.`,
);
console.log(`\n(${finished.length} finished series looked at)`);
await prisma.$disconnect();
await pool.end();

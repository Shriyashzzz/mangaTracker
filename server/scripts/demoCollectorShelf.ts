// Builds the collector tour's practice shelf (client/src/lib/demoCollector.json)
// from a real collection in the local database: its series, what it owns of
// each, its deluxe and omnibus books, and each series' volume list with real
// ISBNs, so the tour shows real covers. Prices paid and purchase days are made
// up (the tour says its prices are). Nothing is written to the database.
//
//   npx tsx scripts/demoCollectorShelf.ts <username>
//   then, in client/: npx prettier --write src/lib/demoCollector.json
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { pool, prisma } from "../src/config/prisma.js";
import { volumesKey } from "../src/prices/volumesKey.js";
import { editionLinesOf } from "../src/prices/editionSource.js";

const SERIES = 40;
const OUT = new URL("../../client/src/lib/demoCollector.json", import.meta.url);

// always on it: the editions, the long runs, and the series with real gaps
const MUST = [
  "One Piece",
  "Berserk",
  "Naruto",
  "Monster",
  "Vagabond",
  "Haikyu!!",
  "Detective Conan",
  "Frieren: Beyond Journey's End",
];

// series cut short for the tour: owned and read up to this volume. Berserk
// stops at 7, so its books are a few and mixed: Deluxe 1 and 2 (vols. 1 to
// 6) and a single vol. 7, with Deluxe 3 next to buy and plenty left to show
const UP_TO: Record<string, number> = { Berserk: 7 };

type Saved = { volume: number | null; isbn13: string };

// a steady made-up number from a seed, so the file is the same each run
const steady = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

async function main() {
  const username = process.argv[2];
  if (!username) throw new Error("Whose shelf? npx tsx ... <username>");
  const user = await prisma.user.findFirstOrThrow({ where: { username } });
  const shelf = await prisma.manga.findMany({
    where: { userId: user.id, lightNovel: false },
    include: { books: true },
  });

  // each series with a saved volume list: whole numbered volumes only
  const listed: {
    m: (typeof shelf)[number];
    byVolume: Map<number, string>;
    owned: number[];
  }[] = [];
  for (const m of shelf) {
    const row = await prisma.seriesVolumes.findUnique({
      where: { key: volumesKey(m.name) },
    });
    const books = ((row?.volumes ?? []) as Saved[]).filter(
      (b) => b.volume != null && Number.isInteger(b.volume),
    );
    const byVolume = new Map(books.map((b) => [b.volume!, b.isbn13]));
    const owned = m.ownedList.length
      ? m.ownedList.filter(Number.isInteger)
      : Array.from({ length: m.volumesOwned ?? 0 }, (_, i) => i + 1);
    if (byVolume.size < 3 || !owned.length) continue;
    listed.push({ m, byVolume, owned });
  }

  // the must-haves, then the rest in a steady shuffle, so the shelf mixes
  // short series with long runs as a real one does
  const must = MUST.flatMap((name) => listed.filter((s) => s.m.name === name));
  const rest = listed
    .filter((s) => !must.includes(s))
    .sort((a, b) => steady(a.m.id) - steady(b.m.id))
    .slice(0, SERIES - must.length);

  const picked = [...must, ...rest];
  // each series' omnibus and deluxe lines, as saved: never a search
  const editions = await Promise.all(
    picked.map(({ m }) => editionLinesOf(m.name, [], false).catch(() => [])),
  );
  const series = picked.map(({ m, byVolume, owned: all }, i) => {
    const id = i + 1;
    const upTo = UP_TO[m.name];
    const owned = upTo ? all.filter((v) => v <= upTo) : all;
    // its books, less any holding a volume past where it's cut short
    const kept = m.books.filter(
      (b) => !upTo || b.volumes.every((v) => v <= upTo),
    );
    // made-up prices paid on the deluxe and omnibus books, and on the
    // singles of a few series, so "Spent so far" has something to add up
    const paidSingles = i % 6 === 2;
    const books = kept.length
      ? kept
          .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
          .map((b, j) => ({
            edition: b.edition,
            number: b.number,
            title: b.title,
            isbn13: b.isbn13,
            volumes: b.volumes,
            paidCents:
              b.edition === "deluxe"
                ? 3200 + Math.round(steady(id * 100 + j) * 12) * 100 - 1
                : 1100 + Math.round(steady(id * 100 + j) * 4) * 100 - 1,
            boughtOn: dayOf(id * 100 + j),
          }))
          // what those books don't hold, bought as single volumes
          .concat(
            owned
              .filter((v) => !kept.some((b) => b.volumes.includes(v)))
              .map((v, j) => ({
                edition: "single",
                number: v,
                title: null,
                isbn13: byVolume.get(v) ?? null,
                volumes: [v],
                paidCents: 1099 + Math.round(steady(id * 50 + j) * 4) * 100,
                boughtOn: dayOf(id * 50 + j),
              })),
          )
      : paidSingles
        ? owned.slice(0, 12).map((v, j) => ({
            edition: "single",
            number: v,
            title: null,
            isbn13: byVolume.get(v) ?? null,
            volumes: [v],
            paidCents: 699 + Math.round(steady(id * 100 + j) * 4) * 100,
            boughtOn: dayOf(id * 100 + j),
          }))
        : [];
    const contiguous =
      owned.length === Math.max(...owned) && owned.every((v, k) => v === k + 1);
    return {
      id,
      name: m.name,
      genre: m.genre ?? "",
      image: m.image,
      status: m.status,
      planned: m.planned,
      bookmark: m.bookmark,
      rating: m.rating,
      edition: m.edition,
      volumesOwned: contiguous ? owned.length : null,
      ownedList: contiguous ? [] : owned,
      // [volume, ISBN] for every volume known in English
      volumes: [...byVolume].sort((a, b) => a[0] - b[0]),
      books,
      editions: editions[i]!,
    };
  });

  writeFileSync(OUT, JSON.stringify(series) + "\n");
  const volumes = series.reduce(
    (sum, s) => sum + (s.volumesOwned ?? s.ownedList.length),
    0,
  );
  const gaps = series.filter(
    (s) => (s.volumesOwned ?? s.ownedList.length) < s.volumes.length,
  ).length;
  console.log(
    `${series.length} series, ${volumes} volumes, ${gaps} with volumes not on the shelf`,
  );
}

// a day in the last two years
function dayOf(seed: number) {
  const day = new Date(Date.UTC(2024, 10, 1));
  day.setUTCDate(day.getUTCDate() + Math.floor(steady(seed) * 720));
  return day.toISOString().slice(0, 10);
}

await main();
await prisma.$disconnect();
await pool.end();

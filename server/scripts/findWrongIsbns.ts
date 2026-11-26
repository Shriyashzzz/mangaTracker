// Finds series lists' wrong ISBNs, and their printed books, from eBay alone
// (src/prices/wrongIsbns.ts has the rules). Each look spends eBay calls from
// the day's shared allowance: 1 to judge a volume, up to 5 more to find its
// printed book. The site, a laptop and this script all count against it.
//
//   npx tsx scripts/findWrongIsbns.ts --score [--sample 40]
//       how often it's right, against the collectors' lists: wrong ISBNs
//       they replaced (it should flag them and find theirs) and their own
//       books (it should leave them alone). Writes nothing
//   npx tsx scripts/findWrongIsbns.ts [--limit 50]
//       dry run over the saved series lists: the volumes it would fix
//   ... --apply                 adds what it finds as trusted books (trust 1,
//                               source auto-ebay): series lists take them by
//                               the usual rules, a collector's list wins
//   --db <url>                  defaults to DATABASE_URL in server/.env
import "dotenv/config";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
if (arg("db")) process.env.DATABASE_URL = arg("db");
const score = process.argv.includes("--score");
const apply = process.argv.includes("--apply");
const sample = Number(arg("sample") ?? 40);
const limit = Number(arg("limit") ?? 50);

const { prisma } = await import("../src/config/prisma.js");
const { ebayListings, ebayItemIsbn, titleQueries } =
  await import("../src/prices/providers/ebay.js");
const rules = await import("../src/prices/wrongIsbns.js");
const trusted = await import("../src/prices/trustedBooks.js");
const { seriesName } = await import("../src/prices/stores/match.js");
const { novelName } = await import("../src/prices/lightNovel.js");
const { FINAL } = await import("../src/prices/seriesCache.js");
const { VOLUMES_KEY_VERSION } = await import("../src/prices/volumesKey.js");

const signal = AbortSignal.timeout(30 * 60 * 1000);
let calls = 0;

// how many listings eBay has under an ISBN (one call)
async function listingsOf(isbn13: string) {
  calls++;
  return (await ebayListings(isbn13, signal)).length;
}

// the printed book of a volume whose ISBN looks wrong, by what sellers of
// that volume say its ISBN is, or null (up to 1 + READ_MOST + 1 calls)
async function printedBookOf(
  bookTitle: string,
  suspect: string,
  suspectListings: number,
  // the series' other volumes' ISBNs: the found one must share a block
  seriesIsbns: string[],
) {
  const q = titleQueries(bookTitle).volume;
  if (!q) return null;
  calls++;
  const items = await ebayListings(q, signal, true);
  const ofVolume = rules
    .listingsOfVolume(items, bookTitle)
    .slice(0, rules.READ_MOST);
  const isbns: (string | null)[] = [];
  for (const item of ofVolume) {
    calls++;
    isbns.push(await ebayItemIsbn(item.itemId!, signal));
    // two sellers agree: no need to read more
    if (rules.agreedIsbn(isbns, suspect)) break;
  }
  const found = rules.agreedIsbn(isbns, suspect);
  if (!found || !rules.sameHouse(found, seriesIsbns)) return null;
  // it must itself sell more than the suspect
  return (await listingsOf(found)) > suspectListings ? found : null;
}

const pick = <T>(list: T[], n: number) =>
  [...list].sort(() => Math.random() - 0.5).slice(0, n);

if (score) {
  // wrong ISBNs a collector's list replaced, and their right books
  const swaps = await prisma.isbnSwap.findMany({
    where: { source: { startsWith: "collector" } },
    select: { fromIsbn: true, toIsbn: true },
  });
  const rights = await prisma.trustedBook.findMany({
    where: {
      source: { startsWith: "collector" },
      isbn13: { in: swaps.map((s) => s.toIsbn) },
    },
    select: { isbn13: true, title: true, seriesKey: true },
  });
  const titleOf = new Map(rights.map((r) => [r.isbn13, r.title]));
  // each series' other books on the lists, for the publisher's block, as a
  // run would use the series list's other volumes
  const keyOf = new Map(rights.map((r) => [r.isbn13, r.seriesKey]));
  const seriesBooks = await prisma.trustedBook.findMany({
    where: { seriesKey: { in: [...keyOf.values()] }, kind: "single" },
    select: { isbn13: true, seriesKey: true },
  });
  const othersOf = (isbn13: string) =>
    seriesBooks
      .filter((b) => b.seriesKey === keyOf.get(isbn13) && b.isbn13 !== isbn13)
      .map((b) => b.isbn13);
  const positives = pick(
    swaps.filter((s) => titleOf.has(s.toIsbn)),
    sample,
  );
  // books on the collectors' lists that no list replaced: right as they are
  const negatives = pick(
    await prisma.trustedBook.findMany({
      where: { source: { startsWith: "collector" }, kind: "single" },
      select: { isbn13: true, title: true },
      take: 2000,
    }),
    sample,
  );

  let flagged = 0;
  let foundRight = 0;
  let foundWrong = 0;
  let foundNone = 0;
  const wrongFinds: string[] = [];
  for (const p of positives) {
    const n = await listingsOf(p.fromIsbn);
    if (!rules.looksWrong(n)) continue;
    flagged++;
    const title = titleOf.get(p.toIsbn)!;
    const found = await printedBookOf(title, p.fromIsbn, n, othersOf(p.toIsbn));
    if (!found) foundNone++;
    else if (found === p.toIsbn) foundRight++;
    else {
      foundWrong++;
      wrongFinds.push(`${title}: found ${found}, the list has ${p.toIsbn}`);
    }
  }
  let falseAlarms = 0;
  for (const r of negatives)
    if (rules.looksWrong(await listingsOf(r.isbn13))) falseAlarms++;

  const pct = (a: number, b: number) =>
    b ? `${Math.round((100 * a) / b)}%` : "-";
  console.log(
    `scored on ${positives.length} wrong ISBNs and ${negatives.length} right ones (${calls} eBay calls)`,
  );
  console.log(
    `  wrong ISBNs flagged: ${flagged} of ${positives.length} (${pct(flagged, positives.length)})`,
  );
  console.log(
    `  right ISBNs flagged by mistake: ${falseAlarms} of ${negatives.length} (${pct(falseAlarms, negatives.length)})`,
  );
  console.log(
    `  of the flagged, printed book found: the list's own ${foundRight}, another ${foundWrong}, none ${foundNone} (right when found: ${pct(foundRight, foundRight + foundWrong)})`,
  );
  for (const w of wrongFinds) console.log(`    ${w}`);
  await prisma.$disconnect();
  process.exit(0);
}

// ---------- a run over the saved lists ----------

const lists = await prisma.seriesVolumes.findMany({
  where: { key: { startsWith: VOLUMES_KEY_VERSION, endsWith: FINAL } },
  select: { key: true, volumes: true },
});
type Listed = {
  isbn13: string;
  title: string;
  volume: number | null;
  inBook?: unknown;
};
const candidates: {
  isbn13: string;
  title: string;
  name: string;
  volume: number;
  // the series' other volumes' ISBNs, for the publisher's block
  others: string[];
}[] = [];
for (const list of lists) {
  const volumes = (list.volumes as unknown as Listed[]).filter(
    (v) =>
      typeof v.volume === "number" && Number.isInteger(v.volume) && !v.inBook,
  );
  if (!volumes.length) continue;
  const listKey = list.key.slice(VOLUMES_KEY_VERSION.length, -FINAL.length);
  const own = seriesName(volumes[0]!.title) || listKey;
  const name = /\blight novel$/.test(listKey) ? novelName(own) : own;
  const listIsbns = volumes.map((v) => v.isbn13.trim());
  for (const v of volumes)
    candidates.push({
      isbn13: v.isbn13.trim(),
      title: v.title,
      name,
      volume: v.volume!,
      others: listIsbns.filter((i) => i !== v.isbn13.trim()),
    });
}
// only books no trusted source has, no store has priced, and not swapped
const isbns = candidates.map((c) => c.isbn13);
const [known, priced, swapped] = await Promise.all([
  prisma.trustedBook.findMany({
    where: { isbn13: { in: isbns } },
    select: { isbn13: true },
  }),
  trusted.pricedIsbns(isbns),
  prisma.isbnSwap.findMany({
    where: { fromIsbn: { in: isbns } },
    select: { fromIsbn: true },
  }),
]);
const skip = new Set([
  ...known.map((k) => k.isbn13),
  ...priced,
  ...swapped.map((s) => s.fromIsbn),
]);
const toLook = candidates.filter((c) => !skip.has(c.isbn13)).slice(0, limit);
console.log(
  `${candidates.length} listed volumes; ${toLook.length} unpriced and untrusted to look at (--limit ${limit})`,
);

let fixes = 0;
for (const c of toLook) {
  const n = await listingsOf(c.isbn13);
  if (!rules.looksWrong(n)) continue;
  const found = await printedBookOf(c.title, c.isbn13, n, c.others);
  console.log(
    `  ${c.title}: ${c.isbn13} has ${n} listings; printed book ${found ?? "not found"}`,
  );
  if (!found) continue;
  fixes++;
  if (!apply) continue;
  const had = await prisma.trustedBook.findUnique({ where: { isbn13: found } });
  if (had) continue;
  const kind = /\blight novel$/i.test(c.name) ? "novel" : "single";
  await prisma.trustedBook.create({
    data: {
      isbn13: found,
      source: rules.AUTO_SOURCE,
      trust: rules.AUTO_TRUST,
      series: c.name.slice(0, 200),
      seriesKey: trusted.trustedSeriesKey(c.name).slice(0, 200),
      kind,
      volume: c.volume,
      title: `${c.name}, Vol. ${c.volume}`.slice(0, 300),
    },
  });
}
console.log(
  `${fixes} printed books found (${calls} eBay calls)${apply ? ", added as trusted books" : "; dry run, add --apply to add them"}`,
);
await prisma.$disconnect();

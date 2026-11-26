// Loads a list of printed books we trust into trusted_books, from any CSV
// with an ISBN-13 and a title ("Series, Vol. 3"): a collector's Libib
// export, a spreadsheet, a publisher's list. Its columns are found by their
// names; release date, pages, description, publisher and price are taken
// when there. Then every saved series list gets its trusted books, by the
// one rule the series pages use (src/prices/trustedBooks.ts applyTrusted).
//
//   npx tsx scripts/loadTrustedBooks.ts <file.csv> --source collector-viz
//       dry run: what it would load, and every volume it would add or swap
//   ... --apply                write it
//   --trust 3                  3 a hand-checked list (the default), 2 three
//                              readers agreeing, 1 found automatically
//   --report <file.tsv>        every change, one a line, for reading
//   --db <url>                 defaults to DATABASE_URL in server/.env
//   --remove                   take every book of --source out again (its
//                              swaps stay: what moved isn't moved back)
//
// A book already there from another source at the same or higher trust is
// left as it is. Two sources giving the same volume different ISBNs are
// listed as conflicts, and nothing about them changes on its own.
// The file itself is never committed: it's someone's own list.
import "dotenv/config";
import fs from "node:fs";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const file = process.argv[2];
const source = arg("source");
const trust = Number(arg("trust") ?? 3);
const apply = process.argv.includes("--apply");
const remove = process.argv.includes("--remove");
const reportFile = arg("report");
if (arg("db")) process.env.DATABASE_URL = arg("db");
if (!source || (!remove && (!file || file.startsWith("--")))) {
  console.error(
    "usage: loadTrustedBooks.ts <file.csv> --source <name> [--apply] [--trust 3] [--report out.tsv] [--db url]\n" +
      "       loadTrustedBooks.ts --source <name> --remove [--apply]",
  );
  process.exit(1);
}
if (![1, 2, 3].includes(trust)) {
  console.error("--trust is 1, 2 or 3");
  process.exit(1);
}

// the site's own modules, once DATABASE_URL is set
const { prisma } = await import("../src/config/prisma.js");
const match = await import("../src/prices/stores/match.js");
const trusted = await import("../src/prices/trustedBooks.js");
const { hasReissue } = await import("../src/prices/reissue.js");
const { reportKey } = await import("../src/util/shelf/editionReports.js");
const { saveSeriesVolumes } = await import("../src/models/savedVolumes.js");
const { FINAL } = await import("../src/prices/seriesCache.js");
const { VOLUMES_KEY_VERSION } = await import("../src/prices/volumesKey.js");
const { readTitle } = await import("../src/prices/trustedTitles.js");
const { novelName } = await import("../src/prices/lightNovel.js");
type Kind = "single" | "edition" | "novel" | "oneshot";
type Read = ReturnType<typeof readTitle>;

// ---------- reading the file ----------

// CSV cells, quotes and line breaks inside them included
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim()));
}

// the first column whose name fits, -1 for none
const column = (headers: string[], ...patterns: RegExp[]) => {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h.trim()));
    if (i >= 0) return i;
  }
  return -1;
};

// ---------- the rows ----------

type Row = {
  isbn13: string;
  isbn10: string | null;
  read: Read;
  publisher: string | null;
  published: string | null;
  pages: number | null;
  description: string | null;
  listCents: number | null;
};

function rowsOf(path: string): { rows: Row[]; skipped: string[] } {
  const [headers = [], ...body] = readCsv(fs.readFileSync(path, "utf8"));
  const at = {
    isbn13: column(
      headers,
      /^(ean_)?isbn_?13$/i,
      /^ean$/i,
      /^isbn$/i,
      /isbn(?!.*10)/i,
    ),
    isbn10: column(headers, /isbn_?10$/i, /isbn.*10/i),
    title: column(headers, /^title$/i, /^book ?title$/i, /title/i),
    publisher: column(headers, /^publisher$/i),
    published: column(
      headers,
      /^publish(ed)?_?date$/i,
      /^(release|published|pub) ?date$/i,
      /^published$/i,
    ),
    pages: column(headers, /^(length|pages|page ?count|number of pages)$/i),
    description: column(headers, /^(description|summary|synopsis)$/i),
    price: column(headers, /^(price|list ?price|msrp)$/i),
  };
  if (at.isbn13 < 0 || at.title < 0) {
    console.error(`${path}: needs an ISBN-13 column and a title column`);
    process.exit(1);
  }
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const rows: Row[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const r of body) {
    const isbn13 = cell(r, at.isbn13).replace(/[^0-9]/g, "");
    const title = cell(r, at.title);
    if (!/^97[89]\d{10}$/.test(isbn13) || !title) {
      skipped.push(`${cell(r, at.isbn13) || "(no ISBN)"}\t${title}`);
      continue;
    }
    if (seen.has(isbn13)) continue;
    seen.add(isbn13);
    const date = cell(r, at.published);
    const pages = Number.parseInt(cell(r, at.pages), 10);
    const price = Number.parseFloat(cell(r, at.price).replace(/[$,]/g, ""));
    const isbn10 = cell(r, at.isbn10).replace(/[^0-9Xx]/g, "");
    rows.push({
      isbn13,
      isbn10: /^\d{9}[\dXx]$/.test(isbn10) ? isbn10.toUpperCase() : null,
      read: readTitle(title),
      publisher: cell(r, at.publisher).slice(0, 120) || null,
      published: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      pages: pages > 0 && pages < 3000 ? pages : null,
      description: cell(r, at.description) || null,
      listCents: price > 0 && price < 1000 ? Math.round(price * 100) : null,
    });
  }
  return { rows, skipped };
}

// ---------- removing a source ----------

if (remove) {
  const n = await prisma.trustedBook.count({ where: { source } });
  console.log(`${source}: ${n} books`);
  if (apply) {
    await prisma.trustedBook.deleteMany({ where: { source } });
    console.log("removed. Series lists keep what they have until rebuilt.");
  } else console.log("dry run: add --apply to remove them");
  await prisma.$disconnect();
  process.exit(0);
}

// ---------- loading ----------

const { rows, skipped } = rowsOf(file!);
const kinds = new Map<Kind, number>();
for (const r of rows) kinds.set(r.read.kind, (kinds.get(r.read.kind) ?? 0) + 1);
const seriesCount = new Set(
  rows
    .filter((r) => r.read.kind === "single")
    .map((r) => trusted.trustedSeriesKey(r.read.series)),
).size;
console.log(
  `${file}: ${rows.length} books, ${skipped.length} rows without a usable ISBN-13 or title`,
);
console.log(
  `  ${[...kinds].map(([k, n]) => `${n} ${k}`).join(", ")}; ${seriesCount} series with numbered volumes`,
);

const existing = new Map(
  (
    await prisma.trustedBook.findMany({
      where: { isbn13: { in: rows.map((r) => r.isbn13) } },
      select: { isbn13: true, source: true, trust: true },
    })
  ).map((b) => [b.isbn13, b]),
);
const loadable = rows.filter((r) => {
  const was = existing.get(r.isbn13);
  return !was || was.source === source || was.trust < trust;
});
console.log(
  `  ${loadable.length} to load (${rows.length - loadable.length} already there from a source trusted as much or more)`,
);

// the same volume, another ISBN, from another source
const others = await prisma.trustedBook.findMany({
  where: {
    source: { not: source },
    kind: { in: ["single", "novel"] },
    seriesKey: {
      in: [
        ...new Set(
          loadable.map((r) => trusted.trustedSeriesKey(r.read.series)),
        ),
      ],
    },
  },
  select: {
    isbn13: true,
    seriesKey: true,
    kind: true,
    volume: true,
    source: true,
  },
});
const otherAt = new Map(
  others.map((o) => [`${o.kind}|${o.seriesKey}|${o.volume}`, o]),
);
const conflicts = loadable.flatMap((r) => {
  const o = otherAt.get(
    `${r.read.kind}|${trusted.trustedSeriesKey(r.read.series)}|${r.read.volume}`,
  );
  return o && o.isbn13 !== r.isbn13
    ? [`${r.read.title}: ${r.isbn13} here, ${o.isbn13} from ${o.source}`]
    : [];
});
if (conflicts.length) {
  console.log(
    `  ${conflicts.length} conflicts with other sources (both kept; the series pages pick one by publisher, then trust):`,
  );
  for (const c of conflicts.slice(0, 20)) console.log(`    ${c}`);
}

if (apply) {
  for (const r of loadable) {
    const data = {
      isbn10: r.isbn10,
      source: source!,
      trust,
      series: r.read.series.slice(0, 200),
      seriesKey: trusted.trustedSeriesKey(r.read.series).slice(0, 200),
      kind: r.read.kind,
      volume: r.read.volume,
      holds: r.read.holds,
      title: r.read.title.slice(0, 300),
      publisher: r.publisher,
      published: r.published,
      pages: r.pages,
      description: r.description,
      listCents: r.listCents,
    };
    await prisma.trustedBook.upsert({
      where: { isbn13: r.isbn13 },
      create: { isbn13: r.isbn13, ...data },
      update: data,
    });
  }
  console.log(`  loaded ${loadable.length}`);
}

// ---------- edition books that say what they hold ----------

// "Ranma 1/2, Vol. 37 & 38 (2-in-1 Vol. 19)": approved as the owner would
// approve a reader's report (util/shelf/editionReports.ts), so the series'
// edition lines show it as certain. Never over a decision already made
const stated = rows.filter(
  (r) =>
    r.read.kind === "edition" && r.read.edition && r.read.holds.length >= 2,
);
let decided = 0;
for (const r of stated) {
  const key = {
    series: reportKey(r.read.series).slice(0, 200),
    edition: r.read.edition!.key,
    number: r.read.edition!.number,
  };
  const had = await prisma.editionDecision.findUnique({
    where: { series_edition_number: key },
  });
  if (had) continue;
  decided++;
  if (apply)
    await prisma.editionDecision.create({
      data: { ...key, status: "approved", volumes: r.read.holds },
    });
}
console.log(
  `  ${stated.length} edition books say what they hold; ${decided} ${apply ? "approved" : "would be approved"} (the rest were decided already)`,
);

// ---------- every saved series list ----------

// the lists the series pages saved (seriesCache.ts finalKey): each gets its
// trusted books now, as the page would the next time it's built
const lists = await prisma.seriesVolumes.findMany({
  where: { key: { startsWith: VOLUMES_KEY_VERSION, endsWith: FINAL } },
  select: { key: true, volumes: true },
});
type Listed = Parameters<typeof trusted.applyTrusted>[1][number];
const report: string[] = ["series\tvolume\tchange\tfrom\tto"];
let added = 0;
let swappedCount = 0;
let seriesChanged = 0;
for (const list of lists) {
  const volumes = (list.volumes as unknown as Listed[]).filter(
    (v) => typeof v.volume === "number",
  );
  if (!volumes.length) continue;
  // the series' name, as its own books give it; a light novel's list is
  // saved under its novel name, and stays one
  const listKey = list.key.slice(VOLUMES_KEY_VERSION.length, -FINAL.length);
  const own = match.seriesName(volumes[0]!.title) || listKey;
  const name = /\blight novel$/.test(listKey) ? novelName(own) : own;
  if (hasReissue([name])) continue;
  const keys = [...new Set([listKey, trusted.trustedSeriesKey(name)])];
  const isbns = volumes.map((v) => v.isbn13);
  const [books, priced] = await Promise.all([
    trusted.trustedBooksFor(keys, isbns),
    trusted.pricedIsbns(isbns),
  ]);
  // in a dry run the books aren't in the table yet: this file's own count
  const fromFile = apply
    ? []
    : loadable
        .filter((r) => keys.includes(trusted.trustedSeriesKey(r.read.series)))
        .map((r) => ({
          isbn13: r.isbn13,
          source: source!,
          trust,
          series: r.read.series,
          seriesKey: trusted.trustedSeriesKey(r.read.series),
          kind: r.read.kind,
          volume: r.read.volume,
          holds: r.read.holds,
          title: r.read.title,
          publisher: r.publisher,
          published: r.published,
          pages: r.pages,
        }));
  const result = trusted.applyTrusted(
    name,
    volumes,
    [...books, ...fromFile],
    priced,
  );
  const before = new Set(volumes.map((v) => v.isbn13.trim()));
  const newOnes = result.volumes.filter(
    (v) =>
      !before.has(v.isbn13.trim()) &&
      !result.swaps.some((s) => s.to === v.isbn13),
  );
  if (!newOnes.length && !result.swaps.length) continue;
  seriesChanged++;
  added += newOnes.length;
  swappedCount += result.swaps.length;
  for (const v of newOnes)
    report.push(`${name}\t${v.volume}\tadded\t\t${v.isbn13}`);
  for (const s of result.swaps)
    report.push(`${name}\t${s.volume}\tswapped\t${s.from}\t${s.to}`);
  if (apply) {
    await saveSeriesVolumes(list.key, result.volumes);
    await trusted.recordSwaps(listKey, result.swaps);
  }
}
console.log(
  `  saved series lists: ${lists.length}; ${seriesChanged} would change: ${added} volumes added, ${swappedCount} ISBNs swapped${apply ? " (done)" : ""}`,
);
if (reportFile) {
  fs.writeFileSync(reportFile, report.join("\n") + "\n");
  console.log(`  every change: ${reportFile}`);
}
if (!apply) console.log("dry run: nothing written. Add --apply to load.");
await prisma.$disconnect();

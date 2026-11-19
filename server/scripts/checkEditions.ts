// How well the app builds the edition lines of popular series, scored
// against what their publishers printed.
//
//   npx tsx scripts/checkEditions.ts            every series below
//   npx tsx scripts/checkEditions.ts naruto     only names holding "naruto"
//   npx tsx scripts/checkEditions.ts --books    also list each line's books
//   npx tsx scripts/checkEditions.ts --store    ask Books-A-Million too, as
//                                               the background job does (one
//                                               of the day's CJ calls a series)
//
// It asks the catalogs afresh (prices/editionSource.ts findEditionLines:
// Open Library and Google Books, both free; up to six of the day's Google
// lookups a series) and reads the hand table (util/shelf/editions.ts). It
// touches no database, so it can be run anywhere, any time: after changing
// the table or the line builder, or to see what the catalogs have gained.
//
// THE LIST. [series, its last volume in English, [edition, books printed,
// the last volume they reach, how sure]]. "sure" editions are finished and
// their counts are the publishers'; "ongoing" ones are still coming out, so
// the numbers are the least there should be; "unsure" ones are from memory
// and only reported, never called wrong. An empty list: the series has no
// omnibus or deluxe line, and the app should find none. Correct this list
// when a publisher adds a book; never the app to fit it.
import { findEditionLines } from "../src/prices/editionSource.js";
import type { EditionLine } from "../src/prices/editionLines.js";
import type { CatalogBook } from "../src/prices/types.js";

type Sure = "sure" | "ongoing" | "unsure";
type Expected = [label: string, books: number, reaches: number, sure: Sure];
const SERIES: [name: string, lastVolume: number, editions: Expected[]][] = [
  ["Berserk", 42, [["Deluxe", 14, 41, "sure"]]],
  [
    "Vagabond",
    37,
    [
      ["VIZBIG", 12, 36, "sure"],
      ["Definitive", 6, 18, "ongoing"],
    ],
  ],
  ["Naruto", 72, [["3-in-1", 24, 72, "sure"]]],
  ["Bleach", 74, [["3-in-1", 25, 74, "sure"]]],
  ["One Piece", 110, [["Omnibus", 34, 102, "ongoing"]]],
  [
    "Dragon Ball",
    42,
    [
      ["3-in-1", 14, 42, "sure"],
      ["VIZBIG", 5, 16, "sure"],
    ],
  ],
  ["Dragon Ball Z", 26, [["VIZBIG", 9, 26, "sure"]]],
  [
    "Fullmetal Alchemist",
    27,
    [
      ["3-in-1", 9, 27, "sure"],
      ["Fullmetal Edition", 18, 27, "sure"],
    ],
  ],
  ["Death Note", 12, [["Black Edition", 6, 12, "sure"]]],
  ["Monster", 18, [["Perfect Edition", 9, 18, "sure"]]],
  ["20th Century Boys", 22, [["Perfect Edition", 11, 22, "sure"]]],
  [
    "Attack on Titan",
    34,
    [
      ["Omnibus", 12, 34, "sure"],
      ["Colossal Edition", 7, 34, "sure"],
    ],
  ],
  [
    "Fruits Basket",
    23,
    [
      ["Collector's Edition", 12, 23, "sure"],
      ["Ultimate Edition", 6, 12, "sure"],
    ],
  ],
  ["Sailor Moon", 12, [["Eternal Edition", 10, 12, "sure"]]],
  ["Cardcaptor Sakura", 12, [["Collector's Edition", 9, 12, "sure"]]],
  // (18 books for 56 volumes: which of them holds the extra two isn't known)
  ["Inuyasha", 56, [["VIZBIG", 18, 56, "unsure"]]],
  [
    "Rurouni Kenshin",
    28,
    [
      ["3-in-1", 9, 28, "sure"],
      ["VIZBIG", 9, 28, "sure"],
    ],
  ],
  ["Ranma 1/2", 38, [["2-in-1", 19, 38, "sure"]]],
  [
    "Vinland Saga",
    28,
    [
      ["2-in-1", 14, 28, "ongoing"],
      ["Deluxe", 8, 24, "ongoing"],
    ],
  ],
  [
    "Blade of the Immortal",
    31,
    [
      ["Omnibus", 10, 31, "sure"],
      ["Deluxe", 10, 31, "sure"],
    ],
  ],
  ["Hellsing", 10, [["Deluxe", 3, 10, "sure"]]],
  ["Gantz", 37, [["Omnibus", 12, 37, "sure"]]],
  ["Battle Angel Alita", 9, [["Deluxe", 5, 9, "sure"]]],
  ["Trigun Maximum", 14, [["Deluxe", 5, 14, "sure"]]],
  ["Soul Eater", 25, [["Perfect Edition", 17, 25, "sure"]]],
  ["Blame!", 10, [["Master Edition", 6, 10, "sure"]]],
  ["Knights of Sidonia", 15, [["Master Edition", 7, 15, "sure"]]],
  ["Lone Wolf and Cub", 28, [["Omnibus", 12, 28, "sure"]]],
  ["D.Gray-man", 28, [["3-in-1", 9, 27, "sure"]]],
  ["Ouran High School Host Club", 18, [["3-in-1", 6, 18, "sure"]]],
  ["Maison Ikkoku", 15, [["Collector's Edition", 10, 15, "sure"]]],
  ["Tokyo Revengers", 31, [["Omnibus", 14, 28, "ongoing"]]],
  ["Skip Beat!", 50, [["3-in-1", 15, 45, "ongoing"]]],
  ["xxxHolic", 19, [["Omnibus", 7, 19, "sure"]]],
  ["Love Hina", 14, [["Omnibus", 5, 14, "sure"]]],
  ["Chobits", 8, [["Anniversary Edition", 4, 8, "sure"]]],
  ["Fairy Tail", 63, [["Master's Edition", 5, 25, "sure"]]],
  ["Noragami", 27, [["Omnibus", 9, 27, "unsure"]]],
  ["The Seven Deadly Sins", 41, [["Omnibus", 14, 41, "unsure"]]],
  ["Fire Force", 34, [["Omnibus", 12, 34, "unsure"]]],
  ["Fushigi Yugi", 18, [["VIZBIG", 6, 18, "sure"]]],
  ["Hot Gimmick", 12, [["VIZBIG", 4, 12, "sure"]]],
  ["Kare Kano", 21, [["3-in-1", 7, 21, "unsure"]]],
  ["Hana-Kimi", 23, [["3-in-1", 8, 23, "sure"]]],
  ["Magic Knight Rayearth", 6, [["Omnibus", 2, 6, "unsure"]]],
  ["Tsubasa: Reservoir Chronicle", 28, [["Omnibus", 10, 28, "unsure"]]],
  ["Negima!", 38, [["Omnibus", 9, 27, "unsure"]]],
  ["Hunter x Hunter", 38, [["3-in-1", 2, 6, "unsure"]]],
  ["Yu Yu Hakusho", 19, [["3-in-1", 2, 6, "unsure"]]],
  // no omnibus or deluxe line in English: the app should find none
  ["Chainsaw Man", 18, []],
  ["Jujutsu Kaisen", 27, []],
  ["Spy x Family", 14, []],
  ["Kaguya-sama: Love Is War", 28, []],
  ["Dorohedoro", 23, []],
  ["Akira", 6, []],
  ["Nana", 21, []],
];

// Who wrote the ones whose names are also plain words: the app passes the
// author AniList gives, and Google's search is then theirs only
const AUTHORS: Record<string, string[]> = {
  Monster: ["Naoki Urasawa"],
  Nana: ["Ai Yazawa"],
  Akira: ["Katsuhiro Otomo"],
  Bleach: ["Tite Kubo"],
  Gantz: ["Hiroya Oku"],
  "Blame!": ["Tsutomu Nihei"],
  Berserk: ["Kentaro Miura"],
  Hellsing: ["Kouta Hirano"],
  Naruto: ["Masashi Kishimoto"],
};
// a pause between series: both catalogs slow a caller that doesn't
const PAUSE_MS = 10_000;
const pause = () => new Promise((done) => setTimeout(done, PAUSE_MS));

const only = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const showBooks = process.argv.includes("--books");
const askTheStore = process.argv.includes("--store");

// "Perfect Edition" and "Perfect" are the same label
const plain = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/edition$/, "");

// a line's real books, as the shelf counts them (client lib/editionShelf.ts
// slotsOf): up to the last one a catalog lists or the table vouches for
function realBooks(line: EditionLine) {
  const last = line.books
    .map((book) => Boolean(book.listed || book.sure))
    .lastIndexOf(true);
  return last < 0 ? line.books : line.books.slice(0, last + 1);
}

// what's wrong with a line, in words; none when it matches
function problemsOf(line: EditionLine, expected: Expected, lastVolume: number) {
  const [, books, reaches, sure] = expected;
  const real = realBooks(line);
  const volumes = real.flatMap((book) => book.volumes);
  const top = volumes.length ? Math.max(...volumes) : 0;
  const problems: string[] = [];
  const atLeast = sure === "ongoing";
  if (atLeast ? real.length < books : real.length !== books)
    problems.push(`${real.length} books, not ${books}`);
  if (atLeast ? top < reaches : top !== reaches)
    problems.push(`reaches vol. ${top}, not ${reaches}`);
  const twice = volumes.filter((v, i) => volumes.indexOf(v) !== i);
  if (twice.length) problems.push(`${twice.length} volumes in two books`);
  const missing: number[] = [];
  for (let v = 1; v <= top; v++) if (!volumes.includes(v)) missing.push(v);
  if (missing.length)
    problems.push(`in no book: vol. ${missing.slice(0, 6).join(", ")}`);
  if (top > lastVolume) problems.push(`past the last volume (${lastVolume})`);
  return problems;
}

// what a line has, in a few words
function factsOf(line: EditionLine) {
  const real = realBooks(line);
  const top = Math.max(0, ...real.flatMap((book) => book.volumes));
  const listed = line.books.filter((book) => book.listed).length;
  const dated = line.books.filter((book) =>
    /^\d{4}-\d{2}-\d{2}/.test(book.published ?? ""),
  ).length;
  const fromTable = line.books.some((book) => book.sure);
  return (
    `${real.length} books to vol. ${top} | ${listed} with an ISBN, ` +
    `${dated} with a release day${fromTable ? " | vouched by the table" : ""}`
  );
}

const tally: Record<string, number> = {};
const count = (what: string) => (tally[what] = (tally[what] ?? 0) + 1);
const row = (name: string, edition: string, verdict: string, note: string) =>
  console.log(name.padEnd(30) + edition.padEnd(22) + verdict.padEnd(12) + note);

for (const [name, lastVolume, editions] of SERIES) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
  // the series' own volumes, as its volume list would give them
  const volumes = Array.from({ length: lastVolume }, (_, i) => ({
    isbn13: "",
    title: `${name}, Vol. ${i + 1}`,
    volume: i + 1,
  })) as unknown as CatalogBook[];
  let lines: EditionLine[];
  try {
    await pause();
    const found = await findEditionLines(
      name,
      volumes,
      AUTHORS[name] ?? [],
      askTheStore,
    );
    lines = found.lines;
    // a catalog that didn't answer can't say an edition is missing: the
    // series isn't scored, and is worth running again on its own
    const silent = [
      !found.answered.openLibrary && "Open Library",
      !found.answered.google && "Google Books",
      !found.answered.store && "Books-A-Million",
    ].filter(Boolean);
    if (silent.length) {
      row(name, "-", "NO ANSWER", `${silent.join(" and ")} didn't answer`);
      count("no answer");
      continue;
    }
  } catch (e) {
    row(name, "-", "NO ANSWER", (e as Error).message);
    count("no answer");
    continue;
  }
  const matched = new Set<EditionLine>();
  for (const expected of editions) {
    const [label, books, , sure] = expected;
    const line =
      lines.find((l) => plain(l.label) === plain(label)) ??
      lines.find(
        (l) =>
          plain(l.label).includes(plain(label)) ||
          plain(label).includes(plain(l.label)),
      );
    if (!line) {
      row(name, label, "MISSING", `${books} books expected (${sure})`);
      count("missing");
      continue;
    }
    matched.add(line);
    const problems = problemsOf(line, expected, lastVolume);
    let verdict = "ok";
    if (problems.length) verdict = sure === "unsure" ? "CHECK" : "WRONG";
    const counted = { ok: "right", CHECK: "to check", WRONG: "wrong" }[
      verdict
    ]!;
    count(counted);
    const facts = factsOf(line);
    row(
      name,
      line.label,
      verdict,
      problems.length ? `${problems.join("; ")} | ${facts}` : facts,
    );
    if (showBooks) {
      const each = line.books.map(
        (b) =>
          `${b.number}:${b.volumes[0]}-${b.volumes.at(-1)}${b.listed ? "" : "*"}`,
      );
      console.log(`    ${each.join(" ")}`);
    }
  }
  for (const line of lines) {
    if (matched.has(line)) continue;
    const sample = line.books.find((book) => book.title)?.title ?? "";
    row(
      name,
      line.label,
      editions.length ? "ALSO" : "UNEXPECTED",
      `${line.books.length} books: ${sample}`,
    );
    count(editions.length ? "also found" : "found where none expected");
  }
  if (!editions.length && !lines.length) {
    row(name, "(none)", "ok", "no editions, none found");
    count("none, rightly");
  }
}
console.log(`\n${JSON.stringify(tally)}`);
process.exit(0);

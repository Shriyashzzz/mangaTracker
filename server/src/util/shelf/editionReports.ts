// Readers telling us an omnibus or deluxe book exists that no catalog lists
// ("Missing a book?" on the editions page). A reported book counts once
// AGREE_TO_SHARE (3) readers say the same book holds the same volumes, or
// the site's owner approves it; one the owner rejects never counts. A book
// that counts is `sure`, as the hand table's are: every page that reads a
// series' lines shows it (lib/editionShelf.ts realBooksOf and its server
// copy util/shelf/realBooks.ts), the series page's shelf and Buy next too.
// Never from one reader alone, and never learning that a book doesn't exist.
import { prisma } from "../../config/prisma.js";
import type { EditionLine } from "../../prices/editionLines.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { AGREE_TO_SHARE } from "./bookVolumeAnswers.js";

export type BookReport = {
  name: string;
  edition: string;
  number: number;
  volumes: number[];
};

// counted books, by series key, then "edition:number": the volumes each holds
type Counted = Map<string, Map<string, number[]>>;
const KEEP_MS = 60_000;
let kept: { at: number; counted: Counted } | null = null;
// goes up with every report or decision: what's kept from the counted books
// elsewhere (the /editions index) is old once it has moved
let changes = 0;
export const reportChanges = () => changes;
const forget = () => {
  kept = null;
  changes++;
};

const volumesText = (volumes: number[]) =>
  [...volumes].sort((a, b) => a - b).join(",");

// the books that count now: approved, or agreed by enough readers and not
// rejected. Read from the database at most once a minute
export async function countedBooks(now = Date.now()): Promise<Counted> {
  if (kept && now - kept.at < KEEP_MS) return kept.counted;
  const [reports, decisions] = await Promise.all([
    prisma.editionReport.findMany({
      select: { series: true, edition: true, number: true, volumes: true },
    }),
    prisma.editionDecision.findMany(),
  ]);
  const counted: Counted = new Map();
  const put = (
    series: string,
    edition: string,
    number: number,
    volumes: number[],
  ) => {
    const of = counted.get(series) ?? new Map<string, number[]>();
    of.set(`${edition}:${number}`, volumes);
    counted.set(series, of);
  };
  const decided = new Map(
    decisions.map((d) => [`${d.series}|${d.edition}|${d.number}`, d]),
  );
  for (const d of decisions)
    if (d.status === "approved") put(d.series, d.edition, d.number, d.volumes);
  // readers agreeing on a book and what it holds
  const agreeing = new Map<string, number>();
  for (const r of reports) {
    const key = `${r.series}|${r.edition}|${r.number}|${volumesText(r.volumes)}`;
    agreeing.set(key, (agreeing.get(key) ?? 0) + 1);
  }
  for (const [key, readers] of agreeing) {
    if (readers < AGREE_TO_SHARE) continue;
    const [series, edition, number, volumes] = key.split("|");
    if (decided.has(`${series}|${edition}|${number}`)) continue;
    put(series!, edition!, Number(number), volumes!.split(",").map(Number));
  }
  kept = { at: now, counted };
  return counted;
}

// a series' lines with the books that count added or vouched for: a book the
// line has already is marked `sure`; one it hasn't is put in, in order
export function withCountedBooks(
  counted: Counted,
  name: string,
  lines: EditionLine[],
): EditionLine[] {
  const of = counted.get(volumesKey(name));
  if (!of?.size) return lines;
  return lines.map((line) => {
    const books = [...line.books];
    let changed = false;
    for (const [key, volumes] of of) {
      const [edition, number] = key.split(":");
      if (edition !== line.key) continue;
      const at = books.findIndex((b) => b.number === Number(number));
      if (at >= 0) {
        if (!books[at]!.sure) books[at] = { ...books[at]!, sure: true };
      } else
        books.push({
          number: Number(number),
          volumes,
          isbn13: null,
          title: null,
          listed: false,
          sure: true,
        });
      changed = true;
    }
    if (!changed) return line;
    return { ...line, books: books.sort((a, b) => a.number - b.number) };
  });
}

// a signed-in reader's report; one per reader per book (a second one
// replaces the first)
export async function reportBook(userId: number, report: BookReport) {
  const series = volumesKey(report.name);
  const volumes = [...new Set(report.volumes)].sort((a, b) => a - b);
  await prisma.editionReport.upsert({
    where: {
      userId_series_edition_number: {
        userId,
        series,
        edition: report.edition,
        number: report.number,
      },
    },
    create: {
      userId,
      series,
      name: report.name,
      edition: report.edition,
      number: report.number,
      volumes,
    },
    update: { volumes, name: report.name },
  });
  forget();
}

// the owner's review page: every reported book, the readers behind each set
// of volumes, and what's been decided
export async function reportsToReview() {
  const [reports, decisions, counted] = await Promise.all([
    prisma.editionReport.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.editionDecision.findMany(),
    countedBooks(),
  ]);
  const decided = new Map(
    decisions.map((d) => [`${d.series}|${d.edition}|${d.number}`, d.status]),
  );
  const books = new Map<
    string,
    {
      series: string;
      name: string;
      edition: string;
      number: number;
      // each set of volumes said, with how many readers said it
      said: Map<string, number>;
      lastAt: Date;
    }
  >();
  for (const r of reports) {
    const key = `${r.series}|${r.edition}|${r.number}`;
    const book = books.get(key) ?? {
      series: r.series,
      name: r.name,
      edition: r.edition,
      number: r.number,
      said: new Map<string, number>(),
      lastAt: r.createdAt,
    };
    const text = volumesText(r.volumes);
    book.said.set(text, (book.said.get(text) ?? 0) + 1);
    books.set(key, book);
  }
  return [...books.entries()].map(([key, b]) => ({
    series: b.series,
    name: b.name,
    edition: b.edition,
    number: b.number,
    said: [...b.said].map(([volumes, readers]) => ({
      volumes: volumes ? volumes.split(",").map(Number) : [],
      readers,
    })),
    lastAt: b.lastAt,
    // "approved", "rejected", "agreed" (counted by readers) or "waiting"
    status:
      decided.get(key) ??
      (counted.get(b.series)?.has(`${b.edition}:${b.number}`)
        ? "agreed"
        : "waiting"),
  }));
}

// the owner's say on a reported book
export async function decideBook(
  series: string,
  edition: string,
  number: number,
  status: "approved" | "rejected",
  volumes: number[],
) {
  await prisma.editionDecision.upsert({
    where: { series_edition_number: { series, edition, number } },
    create: { series, edition, number, status, volumes },
    update: { status, volumes, decidedAt: new Date() },
  });
  forget();
}

// Books grouped into series, one shelf entry each: what's owned and read,
// the names to search AniList by, and the entry sent to the server. Part of
// the book import (bookImport.ts lists the parts).
import { latestDate } from "./importDate";
import { ownedVolumes } from "../ownedVolumes";
import type { MalEntry } from "./malImport";
import { type Book, type BookSeries } from "./bookTypes";
import { LATIN, seriesKey } from "./bookNames";
import { bookListOf } from "./bookColumns";
import { joinSubtitleNames } from "./bookVolumes";

// ---------- grouping ----------

// one shelf entry per series, and the light novel of a series is its own. A
// book joins every group that shares one of its names, so "Made in Abyss,
// Vol. 3" and "メイドインアビス 5 [Made in Abyss 5]" are one series. Volumes
// owned is the highest volume they bought, or the highest they've read if
// that's further on. Reading a volume now counts everything before it as read
export function groupBooks(everyBook: Book[]): BookSeries[] {
  // after the files are put together, so a name in one joins another's
  const books = joinSubtitleNames(everyBook);
  // union-find over the names' keys
  const parent = new Map<string, string>();
  const root = (key: string): string => {
    const up = parent.get(key) ?? key;
    if (up === key) return key;
    const top = root(up);
    parent.set(key, top);
    return top;
  };
  const keysOf = (book: Book) =>
    book.names.flatMap((name) => {
      const k = seriesKey(name);
      // as the server keys them (server/src/util/shelf/titleKey.ts shelfKey)
      return k ? [book.lightNovel ? `${k} (light novel)` : k] : [];
    });
  for (const book of books) {
    const [first, ...rest] = keysOf(book);
    if (!first) continue;
    if (!parent.has(first)) parent.set(first, first);
    for (const k of rest) {
      if (!parent.has(k)) parent.set(k, k);
      const a = root(first);
      const b = root(k);
      if (a !== b) parent.set(b, a);
    }
  }
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const [first] = keysOf(book);
    if (!first) continue;
    const top = root(first);
    groups.set(top, [...(groups.get(top) ?? []), book]);
  }
  return [...groups.values()].map((list) => {
    // the name most of its books use, one in Latin letters before any other
    const uses = new Map<string, { name: string; count: number }>();
    for (const b of list)
      for (const name of b.names) {
        // "Wolf & Parchment" and "Wolf Parchment" are one series, but two
        // ways to search it
        const k = seriesKey(name) + (name.includes("&") ? " &" : "");
        if (!seriesKey(name)) continue;
        const was = uses.get(k);
        uses.set(k, { name: was?.name ?? name, count: (was?.count ?? 0) + 1 });
      }
    const ranked = [...uses.values()].sort(
      (a, b) =>
        Number(LATIN.test(b.name)) - Number(LATIN.test(a.name)) ||
        b.count - a.count,
    );
    const title = ranked[0]?.name ?? list[0]!.series;
    const lightNovel = list[0]!.lightNovel;
    const key = seriesKey(title);
    const volumesOf = (b: Book) =>
      b.holds ?? (b.volume != null ? [b.volume] : []);
    // the furthest whole volume; a 10.5 or a vol. 0 is owned, not a run
    const furthest = (picked: Book[]) => {
      const numbered = picked.flatMap(volumesOf);
      const whole = numbered.filter((v) => Number.isInteger(v) && v >= 1);
      return Math.floor(
        whole.length
          ? Math.max(...whole)
          : numbered.length
            ? 0
            : // unnumbered books count one each, but not one that holds
              // several nobody has said (a box set isn't "vol. 1")
              picked.filter((b) => !b.omnibus).length,
      );
    };
    const owned = furthest(list.filter((b) => b.owned));
    const ownedBooks = list.filter((b) => b.owned);
    // the numbered ones exactly, gaps and all, even beside a box set that
    // doesn't say what it holds (that one is asked about: omnibus). Null only
    // when no owned book has a number
    const numberedOwned = ownedBooks.filter((b) => b.volume != null);
    const ownedList =
      numberedOwned.length || !ownedBooks.length
        ? [...new Set(numberedOwned.flatMap(volumesOf))].sort((a, b) => a - b)
        : null;
    // on vol. 5 now means 1 to 4 are read, marked or not
    const readingFrom = list.flatMap((b) =>
      b.reading && b.volume != null
        ? [Math.max(0, Math.floor(b.volume) - 1)]
        : [],
    );
    const read = Math.max(furthest(list.filter((b) => b.read)), ...readingFrom);
    const rated = list.filter((b) => b.rating > 0);
    const average =
      rated.reduce((sum, b) => sum + b.rating, 0) / (rated.length || 1);
    return {
      key: lightNovel ? `${key} (light novel)` : key,
      title,
      otherNames: ranked.slice(1).map((r) => r.name),
      books: list.length,
      // books that don't say what they hold count for nothing until Edit
      // says (they were "vol. 1", which a box set of 27 isn't)
      ownedVolumes: Math.max(0, Math.min(Math.max(owned, read), 999)),
      ownedList,
      readVolumes: Math.max(0, Math.min(read, 999)),
      score: Math.round(average * 2),
      planned: list.every((b) => b.planned),
      lightNovel,
      ...(list.some((b) => b.omnibus)
        ? {
            omnibus: true,
            unsure: list.filter((b) => b.omnibus).map((b) => b.title),
          }
        : {}),
      // their own export's (ownExportBooks)
      ...(list.some((b) => b.exact) ? { restore: true } : {}),
      ...(list.find((b) => b.genre)
        ? { genre: list.find((b) => b.genre)!.genre }
        : {}),
      ...(list.some((b) => b.finished) ? { finished: true } : {}),
      ...(list.some((b) => b.chapter)
        ? { chapters: Math.max(...list.map((b) => b.chapter ?? 0)) }
        : {}),
      ...(list.find((b) => b.notes)
        ? { notes: list.find((b) => b.notes)!.notes }
        : {}),
      // the latest any of its books was changed, where the file says
      ...(latestDate(list.map((b) => b.changedOn))
        ? { updatedAt: latestDate(list.map((b) => b.changedOn)) }
        : {}),
      ...bookListOf(ownedBooks, volumesOf),
      ...(list.find((b) => b.collecting)
        ? { collecting: list.find((b) => b.collecting)!.collecting }
        : {}),
      ...(list.some((b) => b.readTo)
        ? { readTo: Math.max(...list.map((b) => b.readTo ?? 0)) }
        : {}),
      ...(list.some((b) => b.byVolume != null)
        ? { byVolume: list.some((b) => b.byVolume) }
        : {}),
    };
  });
}

// other ways to search for a series AniList didn't find by its name:
// "Kon Kon Kokon 1" → "Kon Kon Kokon", "RWBY: The Official Manga: The Beacon
// Arc" → "RWBY", "Made in Abyss Official Anthology - Layer 2" → "Made in Abyss
// Official Anthology"
export function searchFallbacks(name: string): string[] {
  const out = [
    name.replace(/\s+#?\d{1,3}$/, ""),
    name.split(/\s*:\s+/)[0]!,
    name.split(/\s+(?:-{1,2}|[–—])\s+/)[0]!,
    // the creator's name in front: "Naoki Urasawa's Monster"
    name.replace(/^\p{Lu}[\p{L}.-]+\s+\p{Lu}[\p{L}.-]+['’]s\s+/u, ""),
  ].map((n) => n.trim());
  return [...new Set(out)].filter((n) => n !== name && /\p{L}{2}/u.test(n));
}

// books that go with a series but aren't its manga: a shorter name would find
// the series itself ("Cardcaptors: Cinemanga" isn't Cardcaptor Sakura)
const NOT_THE_MANGA =
  /\b(cine-?manga|anime comics?|film comics?|ani-?manga|fan ?book|guide ?book|(official|character|visual|complete) guide|character (files|book)|art ?book|artworks?|illustrations|data ?book|ultimania|colou?ring book|sketchbook|calendar|novelization)\b/i;

// what matching searches AniList for, in order: its own names, then shorter
// forms, which count only when AniList has something called exactly that, so
// "Star Wars: Thrawn" (or "Star Wars 3") can't turn into some Star Wars manga.
// A shorter form with a subtitle taken off is a cut: what it finds may be the
// series this book is a spin-off of (withoutSpinOffs). Taking off a number on
// the end or the creator's name in front isn't. A book that isn't the manga
// gets no shorter forms
export function searchPlan(s: {
  title: string;
  otherNames: string[];
}): { name: string; exactOnly: boolean; cut?: true }[] {
  const own = [...new Set([s.title, ...s.otherNames])];
  const plan: { name: string; exactOnly: boolean; cut?: true }[] = own.map(
    (name) => ({ name, exactOnly: false }),
  );
  if (NOT_THE_MANGA.test(s.title)) return plan;
  const cuts = new Set([
    s.title.split(/\s*:\s+/)[0]!.trim(),
    s.title.split(/\s+(?:-{1,2}|[–—])\s+/)[0]!.trim(),
  ]);
  for (const name of searchFallbacks(s.title)) {
    if (own.includes(name)) continue;
    plan.push({
      name,
      exactOnly: true,
      ...(cuts.has(name) ? { cut: true } : {}),
    });
  }
  return plan;
}

// the volumes a series' row says it has: those owned, or for a row with none
// owned, those read (a spin-off they've only read still clashes). Owned ones
// alone otherwise: "read up to 13" on Last Order's vol. 13 isn't 1 to 13
const ownedOfRow = (s: BookSeries) => {
  const owned = s.ownedList?.length
    ? s.ownedList
    : Array.from({ length: s.ownedVolumes }, (_, i) => i + 1);
  return new Set(
    owned.length
      ? owned
      : Array.from({ length: s.readVolumes }, (_, i) => i + 1),
  );
};

// a match found only by cutting the title short ("Dance in the Vampire Bund"
// for "…: Forgotten Tales") whose volumes clash with another row of the same
// AniList series is a book AniList doesn't have, not more of that series:
// its vol. 1 isn't the series' vol. 1. Two such books clash with each other
// too (Forgotten Tales and Scarlet Order, both vol. 1), while different
// volumes ("Last Order: Angel Reborn" vol. 1, "…: Angel Eternal" vol. 3) are
// one series. Those that clash count as not on AniList, so they can't fold in
export function withoutSpinOffs<
  M extends { anilistId?: number; shorter?: true } | null | "failed",
>(found: BookSeries[], matches: Map<string, M>): Map<string, M | null> {
  const bySeries = new Map<number, { row: BookSeries; cut: boolean }[]>();
  for (const s of found) {
    const m = matches.get(s.key);
    if (m && m !== "failed" && m.anilistId) {
      bySeries.set(m.anilistId, [
        ...(bySeries.get(m.anilistId) ?? []),
        { row: s, cut: Boolean(m.shorter) },
      ]);
    }
  }
  const volumes = new Map<string, Set<number>>();
  const volumesOf = (s: BookSeries) => {
    if (!volumes.has(s.key)) volumes.set(s.key, ownedOfRow(s));
    return volumes.get(s.key)!;
  };
  const out = new Map<string, M | null>(matches);
  for (const rows of bySeries.values()) {
    if (rows.length < 2) continue;
    for (const { row, cut } of rows) {
      if (!cut) continue;
      const mine = volumesOf(row);
      const clash = rows.some(
        (other) =>
          other.row !== row &&
          [...volumesOf(other.row)].some((v) => mine.has(v)),
      );
      if (clash) out.set(row.key, null);
    }
  }
  return out;
}

// what they changed on a series with Edit, before adding: the series they
// chose themselves (null: not on AniList), and how many volumes they own
// `list`: exactly which, when they typed some with gaps ("1-23, 104")
export type EditOf<M> = { match?: M | null; volumes?: number; list?: number[] };

// the matches as they've edited them: their choice of series in place of the
// import's, then the spin-off check over the lot, so a spin-off is judged
// against what they chose. A series they chose is never a cut match, so the
// check never undoes it
export function withEdits<
  M extends { anilistId?: number; shorter?: true } | null | "failed",
>(
  found: BookSeries[],
  matches: Map<string, M>,
  edits: Map<string, EditOf<Exclude<M, "failed" | null>>>,
): Map<string, M | null> {
  const chosen = new Map<string, M | null>(matches);
  for (const [key, edit] of edits)
    if (edit.match !== undefined) chosen.set(key, edit.match as M | null);
  return withoutSpinOffs(found, chosen);
}

// the row's edit, from any series in it (they're saved on all of them)
export const editOf = <E>(s: BookSeries, edits: Map<string, E>) =>
  (s.members ?? [s.key]).map((k) => edits.get(k)).find(Boolean);

// a row with the volume count they gave it. On the row as listed (after
// mergeSameSeries), so a series spelt two ways takes their count, not the
// larger of the two. Volumes owned means it's no longer only on a to-read list
export function withVolumes(
  s: BookSeries,
  edits: Map<string, { volumes?: number; list?: number[] }>,
): BookSeries {
  const edit = editOf(s, edits);
  if (edit?.volumes === undefined) return s;
  const list = edit.list?.length ? edit.list : null;
  return {
    ...s,
    ownedVolumes: edit.volumes,
    ownedList: list,
    omnibus: false,
    planned: s.planned && edit.volumes === 0 && !list,
  };
}

// rows AniList says are one series (its English and romaji names, "Hunter x
// Hunter" spelt two ways) come in as one: the furthest volumes of either
export function mergeSameSeries(
  found: BookSeries[],
  seriesId: (s: BookSeries) => number | null | undefined,
): BookSeries[] {
  const byId = new Map<string, BookSeries>();
  const out: BookSeries[] = [];
  for (const s of found) {
    const id = seriesId(s);
    const key = id ? `${id}:${s.lightNovel}` : null;
    const first = key ? byId.get(key) : undefined;
    if (!first) {
      const copy = { ...s, members: [s.key] };
      if (key) byId.set(key, copy);
      out.push(copy);
      continue;
    }
    first.members!.push(s.key);
    first.books += s.books;
    first.ownedVolumes = Math.max(first.ownedVolumes, s.ownedVolumes);
    // both exact: together; either one not: no longer exact
    first.ownedList =
      first.ownedList && s.ownedList
        ? [...new Set([...first.ownedList, ...s.ownedList])].sort(
            (a, b) => a - b,
          )
        : null;
    if (s.bookList) first.bookList = [...(first.bookList ?? []), ...s.bookList];
    first.readVolumes = Math.max(first.readVolumes, s.readVolumes);
    first.score = Math.max(first.score, s.score);
    first.planned = first.planned && s.planned;
    if (s.omnibus) first.omnibus = true;
    if (s.unsure) first.unsure = [...(first.unsure ?? []), ...s.unsure];
    first.otherNames = [
      ...new Set([...first.otherNames, s.title, ...s.otherNames]),
    ];
  }
  return out;
}

const otherNamesOf = (
  s: BookSeries,
  match?: { name?: string; names?: string[] },
) => {
  const names = [
    ...new Set([s.title, ...s.otherNames, ...(match?.names ?? [])]),
  ]
    .filter((n) => n && n !== (match?.name || s.title))
    .map((n) => n.slice(0, 300))
    .slice(0, 12);
  return names.length ? { otherNames: names } : {};
};

export const toEntry = (
  s: BookSeries,
  match?: {
    malId: number | null;
    cover: string | null;
    name?: string;
    names?: string[];
  },
): MalEntry => ({
  ...(match?.malId ? { malId: match.malId } : {}),
  ...(match?.cover ? { cover: match.cover } : {}),
  // the series' own name, as the preview shows it ("Detective Conan" for a
  // file's "Case Closed"), and every other name it goes by, so one already
  // on the shelf under any of them is found and never added twice
  title: (match?.name || s.title).slice(0, 300),
  ...otherNamesOf(s, match),
  finished: Boolean(s.finished),
  ...(s.planned ? { planned: true } : {}),
  ...(s.lightNovel ? { lightNovel: true } : {}),
  chapters: s.chapters ?? 0,
  ...(s.notes ? { comments: s.notes } : {}),
  ...(s.restore ? { restore: true } : {}),
  ...(s.restore && s.genre ? { genre: s.genre } : {}),
  // a backup says the volume read itself; it's apart from what they own
  readVolumes: s.restore ? (s.readTo ?? 0) : s.readVolumes,
  ...(s.restore && s.byVolume != null ? { byVolume: s.byVolume } : {}),
  ...(s.restore && s.collecting ? { edition: s.collecting } : {}),
  ...(s.updatedAt ? { updatedAt: s.updatedAt } : {}),
  // only the books whose volumes go on the shelf: the server keeps no other
  ...(s.bookList?.length ? { books: s.bookList.slice(0, 300) } : {}),
  ownedVolumes: s.ownedVolumes,
  // only with gaps: a run from 1 is what ownedVolumes says already, and keeps
  // counting a volume read further on as theirs, as it always did
  // cleaned the server's way first: a "2049" guessed from a title would
  // otherwise turn the whole batch away
  ...(gapsIn(s.ownedList)
    ? { ownedList: ownedVolumes(null, s.ownedList).ownedList }
    : {}),
  score: s.score,
});

// owned volumes that aren't a run from 1
export const gapsIn = (list: number[] | null | undefined) =>
  Boolean(list?.length) && ownedVolumes(null, list).ownedList.length > 0;

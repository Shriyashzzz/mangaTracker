// What book titles are on AniList, learnt from everyone's imports, so each
// import is faster than the last. Matching runs in the browser at AniList's
// pace (about 30 a minute); before it starts, the browser asks here which of its
// titles are known already, and afterwards it tells us the matches it found.
//
// Trust: a told match is only kept once the server has asked AniList about the
// series itself and the import's own rule agrees the title fits it
// (matchRule.ts), so a wrong or made-up answer can't reach anyone else. Only
// matches are shared: a "not on AniList" can't be checked, and a false one would
// make everyone skip a real series. Titles are kept only as hashes, and nothing
// says whose import they came from.
import { prisma } from "../../config/prisma.js";
import { fitsSearch, matchKey } from "./matchRule.js";

// a series' AniList entry rarely changes; asked again after this
export const MATCH_FRESH_MS = 180 * 24 * 60 * 60 * 1000;
// checking told matches: AniList's ids 50 to a request, one request at a time
// with a pause between, and never more than a short queue waiting
const IDS_PER_REQUEST = 50;
const GAP_MS = 2500;
const MAX_QUEUE = 2000;

export type Search = { name: string; lightNovel: boolean; exactOnly: boolean };
export type Told = Search & { anilistId: number };
export type SharedMatch = {
  anilistId: number;
  malId: number | null;
  name: string;
  cover: string | null;
};

export type Media = {
  id: number;
  idMal: number | null;
  format: string | null;
  isAdult?: boolean | null;
  synonyms: string[] | null;
  title: {
    english: string | null;
    romaji: string | null;
    native: string | null;
  };
  coverImage: { extraLarge: string | null; large: string | null } | null;
};

// its titles and other names; an adult series' other names are left out, as
// they can be loose ("Ulysses" is one of an adult manga's). As the import
// reads them (client/src/lib/anilist.ts namesOf)
export const namesOf = (m: Media) =>
  [
    m.title.english,
    m.title.romaji,
    m.title.native,
    ...(m.isAdult ? [] : (m.synonyms ?? [])),
  ].filter((n): n is string => Boolean(n));

// the match the import would show, from AniList's own answer
export const matchOf = (m: Media, search: string): SharedMatch => ({
  anilistId: m.id,
  malId: m.idMal,
  name: m.title.english || m.title.romaji || search,
  cover: m.coverImage?.extraLarge || m.coverImage?.large || null,
});

// is this search one of this series' names? Same format (a novel search only
// takes novels, a manga search never does) and exactly one of its names. A
// guess the import made by subtitle isn't shared, as it can't be checked:
// "Attack on Titan: Before the Fall" is "Attack on Titan" plus a subtitle,
// and so is the other way round, yet they're two series. Those are searched
// again by each import
export const fits = (told: Search, m: Media) =>
  (m.format === "NOVEL") === told.lightNovel &&
  fitsSearch(told.name, namesOf(m), true);

// ---------- asked before matching ----------

// the known match for each search, in the same order; null for not known
export async function knownMatches(searches: Search[]) {
  const keys = searches.map((s) => matchKey(s.name, s.lightNovel, s.exactOnly));
  const rows = await prisma.importMatch.findMany({
    where: {
      key: { in: [...new Set(keys)] },
      checkedAt: { gt: new Date(Date.now() - MATCH_FRESH_MS) },
    },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return keys.map((k): SharedMatch | null => {
    const r = byKey.get(k);
    return r
      ? { anilistId: r.anilistId, malId: r.malId, name: r.name, cover: r.cover }
      : null;
  });
}

export async function saveMatches(
  rows: { search: Search; match: SharedMatch }[],
) {
  for (const { search, match } of rows) {
    const key = matchKey(search.name, search.lightNovel, search.exactOnly);
    const row = { ...match, checkedAt: new Date() };
    await prisma.importMatch.upsert({
      where: { key },
      create: { key, ...row },
      update: row,
    });
  }
}

// ---------- told after matching ----------

const queue: Told[] = [];
const waiting = new Set<string>();
let running = false;

const MEDIA_BY_IDS = `
  query ($ids: [Int]) {
    Page(perPage: ${IDS_PER_REQUEST}) {
      media(id_in: $ids, type: MANGA) {
        id idMal format isAdult synonyms
        title { english romaji native }
        coverImage { extraLarge large }
      }
    }
  }
`;

export async function mediaByIds(ids: number[]): Promise<Media[]> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: MEDIA_BY_IDS, variables: { ids } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);
  const { data } = (await res.json()) as {
    data?: { Page?: { media?: Media[] } };
  };
  return data?.Page?.media ?? [];
}

// a batch of told matches: AniList's word on each series, then the rule
async function checkBatch(batch: Told[]) {
  const media = await mediaByIds([...new Set(batch.map((t) => t.anilistId))]);
  const byId = new Map(media.map((m) => [m.id, m]));
  const good = batch.flatMap((told) => {
    const m = byId.get(told.anilistId);
    return m && fits(told, m)
      ? [{ search: told, match: matchOf(m, told.name) }]
      : [];
  });
  await saveMatches(good);
  return good.length;
}

async function run() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      // up to 50 different series a request
      const batch: Told[] = [];
      const ids = new Set<number>();
      while (
        queue.length &&
        (ids.size < IDS_PER_REQUEST || ids.has(queue[0]!.anilistId))
      ) {
        const t = queue.shift()!;
        ids.add(t.anilistId);
        batch.push(t);
      }
      try {
        await checkBatch(batch);
      } catch (e) {
        // a passing problem: whoever imports the title next tells us again
        console.error(
          "Checking shared import matches failed:",
          (e as Error).message,
        );
      } finally {
        for (const t of batch)
          waiting.delete(matchKey(t.name, t.lightNovel, t.exactOnly));
      }
      await new Promise((done) => setTimeout(done, GAP_MS));
    }
  } finally {
    running = false;
  }
}

// matches a browser found: checked in the background, kept if they hold up.
// Ones already known (and fresh) aren't checked again
export async function tellMatches(told: Told[]) {
  if (process.env.NODE_ENV === "test") return;
  const fresh = await knownMatches(told);
  for (const [i, t] of told.entries()) {
    const key = matchKey(t.name, t.lightNovel, t.exactOnly);
    if (fresh[i] || waiting.has(key) || queue.length >= MAX_QUEUE) continue;
    waiting.add(key);
    queue.push(t);
  }
  void run();
}

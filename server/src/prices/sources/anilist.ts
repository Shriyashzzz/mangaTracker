// AniList: free, no key. Series score, popularity rank, genres and blurb,
// plus what's trending this season. Same numbers manga.london shows.
// https://docs.anilist.co (rate limit 30-90 requests a minute)
//
// Caches, from slowest to fastest to change:
//   series_info table  a week per series (getSeriesInfo)
//   memory             an hour per typed search, 6h for trending, the
//                      server's life for Japanese -> English names
import { prisma } from "../../config/prisma.js";
import { seriesOf, slugify } from "../stores/match.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { SeriesHit, SeriesInfo } from "../types.js";
import type { MalListing } from "../../util/shelf/malEntry.js";
import { baseName, isNovelName, novelName } from "../lightNovel.js";
import { volumesKey } from "../volumesKey.js";
import priceQueries from "../../models/priceQueries.js";

export { slugify };

const URL = "https://graphql.anilist.co";
const SERIES_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const TRENDING_FRESH_MS = 6 * 60 * 60 * 1000;
const SEARCH_FRESH_MS = 60 * 60 * 1000;

// the bits of AniList's Media type we ask for
type Media = {
  id: number;
  siteUrl: string;
  status: string | null;
  volumes: number | null;
  averageScore: number | null;
  genres: string[] | null;
  synonyms: string[] | null;
  title: {
    english: string | null;
    romaji: string | null;
    native?: string | null;
  };
  coverImage: { large: string | null; medium?: string | null } | null;
  description: string | null;
  rankings: { rank: number; type: string; allTime: boolean }[] | null;
  startDate?: { year: number | null } | null;
  staff?: {
    edges: { role: string; node: { name: { full: string | null } } }[];
  };
};

// AniList answering 429 means slow down: every lookup waits out its
// Retry-After (a minute when it doesn't say) instead of asking again at once,
// which only keeps the block going. Callers already cope with a failed lookup
const ANILIST_PAUSE_MS = 60_000;
let anilistPausedUntil = 0;

async function query<T>(gql: string, variables?: Record<string, unknown>) {
  if (Date.now() < anilistPausedUntil)
    throw new Error("AniList responded 429 (waiting before asking again)");
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gql, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After"));
    anilistPausedUntil =
      Date.now() + (retryAfter > 0 ? retryAfter * 1000 : ANILIST_PAUSE_MS);
    await res.body?.cancel().catch(() => {});
  }
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);
  const { data, errors } = (await res.json()) as {
    data: T;
    errors?: { message: string }[];
  };
  if (errors?.length) throw new Error(`AniList: ${errors[0]!.message}`);
  return data;
}

const BY_MAL_ID_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: MANGA) {
        idMal genres format status chapters
        title { english romaji }
        coverImage { large }
      }
    }
  }
`;

// up to 50 series by their MyAnimeList ids, for importing a list. One retry, as
// a burst of imports can hit AniList's rate limit. Failing is fine: they keep
// the title from their list and go without a cover
export async function getListingsByMalIds(ids: number[]) {
  const listings = new Map<number, MalListing>();
  if (!ids.length) return listings;
  for (const pause of [0, 2000]) {
    try {
      if (pause) await new Promise((done) => setTimeout(done, pause));
      const { Page } = await query<{
        Page: {
          media: (Media & {
            idMal: number | null;
            format: string | null;
            chapters: number | null;
          })[];
        };
      }>(BY_MAL_ID_QUERY, { ids });
      for (const m of Page.media) {
        if (m.idMal == null) continue;
        listings.set(m.idMal, {
          name: m.title.english ?? m.title.romaji ?? "",
          // the romaji title only: what a MyAnimeList list calls it. Not the
          // synonyms, which are loose ("Naruto" is one of The Seventh
          // Hokage's, "8" one of another series'), so an import would skip a
          // series as "already on your shelf" because a different one said so
          altNames: [m.title.romaji ?? ""].filter(Boolean),
          cover: m.coverImage?.large ?? null,
          genre: m.genres?.[0] ?? null,
          lightNovel: m.format === "NOVEL",
          // AniList counts the chapters once a series has finished, and that
          // count is its last chapter: asked in the same request, so a fresh
          // import knows who's caught up before its first release check
          latestChapter:
            m.status === "FINISHED" && m.chapters ? m.chapters : null,
        });
      }
      return listings;
    } catch (e) {
      console.error("AniList by MAL id failed:", (e as Error).message);
    }
  }
  return listings;
}

// the HTML escapes AniList uses in plain-text descriptions
const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
  "&amp;": "&", // last, so "&amp;lt;" becomes "&lt;" and not "<"
};
const decodeEntities = (text: string) =>
  Object.entries(ENTITIES).reduce(
    (out, [entity, char]) => out.replaceAll(entity, char),
    text,
  );

// the story only: AniList adds notes after it ("Note:\n- Winner of the
// Tsugimanga 2024 Award", "Notes: includes one extra chapter"), which read as
// junk in a search result or under a series' name
export const storyOnly = (text: string) =>
  text.split(/\n\s*notes?\s*:/i)[0]!.trim();

// rows saved before storyOnly: tidied as they're read
const tidy = (info: SeriesInfo): SeriesInfo =>
  info.description
    ? { ...info, description: storyOnly(decodeEntities(info.description)) }
    : info;

// AniList descriptions carry <br> and <i> tags and source notes
const plainText = (html: string | null) =>
  decodeEntities(
    (html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
  )
    .replace(/\(Source:[^)]*\)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1500);

// manga, or for a light novel series (lightNovel.ts) the novel
const SERIES_QUERY = `
  query ($search: String, $format: MediaFormat) {
    Media(search: $search, type: MANGA, format: $format, sort: SEARCH_MATCH) {
      id siteUrl status volumes averageScore genres synonyms
      title { english romaji native }
      coverImage { large }
      description(asHtml: false)
      rankings { rank type allTime }
      staff(sort: RELEVANCE, perPage: 8) { edges { role node { name { full } } } }
    }
  }
`;

// a light novel's top five: AniList's first guess for "86—EIGHTY-SIX" is the
// spin-off 86—EIGHTY-SIX Alter, so the one called exactly that is picked
const NOVEL_SERIES_QUERY = `
  query ($search: String) {
    Page(perPage: 5) {
      media(search: $search, type: MANGA, format: NOVEL, sort: SEARCH_MATCH) {
        id siteUrl status volumes averageScore genres synonyms
        title { english romaji native }
        coverImage { large }
        description(asHtml: false)
        rankings { rank type allTime }
        staff(sort: RELEVANCE, perPage: 8) { edges { role node { name { full } } } }
      }
    }
  }
`;
const sameName = (a: string) => a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
export const pickNamed = <M extends Pick<Media, "title" | "synonyms">>(
  search: string,
  media: M[],
) =>
  media.find((m) =>
    [m.title.english, m.title.romaji, ...(m.synonyms ?? [])].some(
      (n) => n && sameName(n) === sameName(search),
    ),
  ) ??
  media[0] ??
  null;

// who wrote and drew it, in English letters ("Eiichiro Oda"): AniList's staff
// in the story and art roles, never assistants, translators or letterers
const CREATOR_ROLE =
  /^(story( & art)?|art|original (story|creator)|illustration)$/i;
export const creatorsOf = (m: Pick<Media, "staff">) =>
  [
    ...new Set(
      (m.staff?.edges ?? [])
        .filter((e) => CREATOR_ROLE.test(e.role.trim()))
        .map((e) => e.node.name.full?.trim() ?? "")
        .filter((n) => n && /^[\p{Script=Latin}\s.'’-]+$/u.test(n)),
    ),
  ].slice(0, 3);

const toInfo = (m: Media): SeriesInfo => ({
  anilistId: m.id,
  name: (m.title.english || m.title.romaji) ?? "",
  score: m.averageScore ?? null,
  popularityRank:
    m.rankings?.find((r) => r.type === "POPULAR" && r.allTime)?.rank ?? null,
  genres: m.genres ?? [],
  description: storyOnly(plainText(m.description)),
  coverUrl: m.coverImage?.large ?? null,
  siteUrl: m.siteUrl,
  status: m.status,
  volumes: m.volumes ?? null,
  // saved with the rest; rows from before it was asked for get it on a later
  // visit, a few a minute (see mayAskForNative)
  nativeName: m.title.native ?? null,
  // the same, for rows saved before authors were asked for
  authors: creatorsOf(m),
  // other names, e.g. Detective Conan is published in the US as Case Closed
  altNames: [m.title.romaji, ...(m.synonyms ?? [])].filter(
    (n): n is string => !!n && /^[\x20-\x7e’]+$/.test(n),
  ),
});

// the novel's info under the novel's names, so its other names lead to novel
// volumes and never the manga's
const asNovel = (info: SeriesInfo): SeriesInfo => ({
  ...info,
  name: novelName(info.name),
  altNames: info.altNames.map(novelName),
});

// every series we've seen, slug -> real name, newest first: knownSeriesName
// for a whole shelf in one query
export async function knownSeriesNames(): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<{ slug: string; name: string }[]>`
    SELECT DISTINCT ON (slug) slug, name FROM (
      SELECT left(trim(both '-' from
               regexp_replace(lower(info->>'name'), '[^a-z0-9]+', '-', 'g')), 80) AS slug,
             info->>'name' AS name, fetched_at
      FROM series_info WHERE info IS NOT NULL
    ) named
    ORDER BY slug, fetched_at DESC
  `;
  return new Map(rows.map((r) => [r.slug, r.name]));
}

// A series address can be just the slug of AniList's name
// (/prices/series/frieren-beyond-journey-s-end), which reaches us as
// "frieren beyond journey s end". If a series we've seen has that slug,
// this gives back its real name; otherwise the name as it came
export async function knownSeriesName(name: string): Promise<string> {
  const slug = slugify(name);
  if (!slug) return name;
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT info->>'name' AS name FROM series_info
    WHERE info IS NOT NULL
      AND left(trim(both '-' from
        regexp_replace(lower(info->>'name'), '[^a-z0-9]+', '-', 'g')), 80) = ${slug}
    ORDER BY fetched_at DESC
    LIMIT 1
  `;
  return rows[0]?.name ?? name;
}

// every series we've looked up, once each (several searched names can lead
// to the same AniList entry), newest answer first. Database only
export async function listKnownSeries(): Promise<SeriesInfo[]> {
  const rows = await prisma.$queryRaw<{ info: SeriesInfo }[]>`
    SELECT DISTINCT ON (info->>'anilistId') info
    FROM series_info
    WHERE info IS NOT NULL AND info->>'name' IS NOT NULL
    ORDER BY info->>'anilistId', fetched_at DESC
  `;
  return rows.map((r) => tidy(r.info));
}

// series info, cached a week in the database so pages stay fast and we stay
// far inside AniList's rate limit. Returns null if AniList has no match
// rows saved before altNames existed don't have it, so they're asked for afresh.
// "Nothing found" is saved as null, and is a complete answer
export const isComplete = (info: unknown) =>
  info == null || Array.isArray((info as Partial<SeriesInfo>).altNames);

// a row saved before the native name (or authors) was asked for gets it on a
// later visit, a few a minute: a whole shelf's release check mustn't ask AniList about
// every series at once (it rate limits, and a failed ask keeps the old row)
const NATIVE_PER_MINUTE = 20;
let nativeAsks = { minute: 0, count: 0 };
export const lacksNativeName = (info: unknown) =>
  info != null && !("nativeName" in (info as object));
export const lacksAuthors = (info: unknown) =>
  info != null && !("authors" in (info as object));
const mayAskForNative = () => {
  const minute = Math.floor(Date.now() / 60_000);
  if (nativeAsks.minute !== minute) nativeAsks = { minute, count: 0 };
  return nativeAsks.count++ < NATIVE_PER_MINUTE;
};

// if AniList can't be asked, an old row still works with its names filled in
export const withAltNames = (info: SeriesInfo): SeriesInfo => ({
  ...info,
  altNames: info.altNames ?? [],
});

export async function getSeriesInfo(name: string): Promise<SeriesInfo | null> {
  const slug = slugify(name);
  if (!slug) return null;
  const cached = await prisma.seriesInfo.findUnique({ where: { slug } });
  // a novel's row saved before novels were looked up as novels holds the
  // manga's answer: asked again
  const wrongFormat =
    isNovelName(name) &&
    cached?.info != null &&
    !isNovelName((cached.info as SeriesInfo).name ?? "");
  if (
    cached &&
    Date.now() - cached.fetchedAt.getTime() < SERIES_FRESH_MS &&
    isComplete(cached.info) &&
    !wrongFormat &&
    !(
      (lacksNativeName(cached.info) || lacksAuthors(cached.info)) &&
      mayAskForNative()
    )
  ) {
    return cached.info ? tidy(cached.info as SeriesInfo) : null;
  }

  try {
    const novel = isNovelName(name);
    const found = novel
      ? pickNamed(
          baseName(name),
          (
            await query<{ Page: { media: Media[] } }>(NOVEL_SERIES_QUERY, {
              search: baseName(name),
            })
          ).Page.media,
        )
      : (
          await query<{ Media: Media | null }>(SERIES_QUERY, {
            search: name,
            format: "MANGA",
          })
        ).Media;
    const info = found
      ? novel
        ? asNovel(toInfo(found))
        : toInfo(found)
      : null;
    // Prisma needs DbNull (SQL NULL) rather than a JS null for a Json column
    const value = info ?? Prisma.DbNull;
    await prisma.seriesInfo.upsert({
      where: { slug },
      create: { slug, info: value, fetchedAt: new Date() },
      update: { info: value, fetchedAt: new Date() },
    });
    return info;
  } catch (e) {
    // no match at all is an answer, kept like any other
    if (/responded 404/.test((e as Error).message)) {
      await prisma.seriesInfo
        .upsert({
          where: { slug },
          create: { slug, info: Prisma.DbNull, fetchedAt: new Date() },
          update: { info: Prisma.DbNull, fetchedAt: new Date() },
        })
        .catch(() => {});
      return null;
    }
    // a stale answer beats none if AniList is down or rate limiting us
    console.error("AniList series lookup failed:", (e as Error).message);
    return cached?.info ? withAltNames(cached.info as SeriesInfo) : null;
  }
}

// manga and light novels in one request: AniList counts requests, not lists
const SEARCH_QUERY = `
  query ($search: String) {
    manga: Page(perPage: 20) {
      media(search: $search, type: MANGA, format: MANGA, sort: SEARCH_MATCH) {
        ...hit
      }
    }
    novel: Page(perPage: 10) {
      media(search: $search, type: MANGA, format: NOVEL, sort: SEARCH_MATCH) {
        ...hit
      }
    }
  }
  fragment hit on Media {
    id averageScore volumes status
    title { english romaji }
    startDate { year }
    coverImage { large medium }
  }
`;

// the manga first and its novel right under it ("Overlord", then "Overlord
// Light Novel"); a novel with no manga here takes its own place in the order.
// Asked for novels ("overlord light novel"), the other way round
export function withNovels<T extends { name: string }>(
  manga: T[],
  novels: T[],
) {
  const key = (name: string) =>
    baseName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  // several novels can share a name: each waits its turn
  const byName = new Map<string, T[]>();
  for (const n of novels)
    byName.set(key(n.name), [...(byName.get(key(n.name)) ?? []), n]);
  const placed = new Set<T>();
  const out: T[] = [];
  const longest = Math.max(manga.length, novels.length);
  for (let i = 0; i < longest; i++) {
    const m = manga[i];
    if (m) {
      out.push(m);
      const pair = byName.get(key(m.name))?.find((n) => !placed.has(n));
      if (pair) {
        out.push(pair);
        placed.add(pair);
      }
    }
    const n = novels[i];
    // a novel whose manga comes later waits for it
    const mangaLater =
      n && manga.slice(i + 1).some((x) => key(x.name) === key(n.name));
    if (n && !placed.has(n) && !mangaLater) {
      out.push(n);
      placed.add(n);
    }
  }
  return out;
}

const searchCache = new Map<string, { at: number; items: SeriesHit[] }>();

// series matching what someone typed (the home page typeahead)
export async function searchSeries(q: string): Promise<SeriesHit[]> {
  return withKnownNovels(await searchAniList(q));
}

// a novel AniList doesn't list (Solo Leveling's, like many Korean web novels)
// but whose page we've built from the catalog: shown under its manga. A
// database check only, and asked fresh each time, so a novel found a minute
// ago shows now
async function withKnownNovels(items: SeriesHit[]): Promise<SeriesHit[]> {
  const listed = new Set(
    items.filter((i) => i.lightNovel).map((i) => slugify(i.name)),
  );
  const missing = items.filter(
    (i) => !i.lightNovel && !listed.has(slugify(novelName(i.name))),
  );
  // the novel by the manga's own name, or one the finder found under another
  // of its names (prices/novelFinder.ts)
  const found = await priceQueries
    .getFoundNovels(missing.map((i) => seriesOf(i.name)))
    .catch(() => new Map<string, { name: string; volumes: number }>());
  const novelOf = (i: SeriesHit) =>
    found.get(seriesOf(i.name))?.name ?? novelName(i.name);
  const sizes = await priceQueries
    .getSavedListSizes(missing.map((i) => volumesKey(novelOf(i))))
    .catch(() => new Map<string, { size: number; coverUrl: string | null }>());
  return items.flatMap((i) => {
    const list = missing.includes(i)
      ? sizes.get(volumesKey(novelOf(i)))
      : undefined;
    if (!list?.size || listed.has(slugify(novelOf(i)))) return [i];
    const name = novelOf(i);
    return [
      i,
      {
        name,
        slug: slugify(name),
        lightNovel: true,
        volumes: list.size,
        score: null,
        // the novel's own first volume (our cover route), not the manga's
        coverUrl: list.coverUrl ?? i.coverUrl,
        thumbUrl: list.coverUrl ?? i.thumbUrl,
      },
    ];
  });
}

async function searchAniList(q: string): Promise<SeriesHit[]> {
  const key = q.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_FRESH_MS) return hit.items;

  // AniList doesn't search on "light novel": it's taken off, and novels lead
  const asked = q.replace(/\s*\b(light\s*novels?|ln)\s*$/i, "").trim();
  const novelsFirst = asked !== q.trim() && asked.length > 0;
  const data = await query<Record<"manga" | "novel", { media: Media[] }>>(
    SEARCH_QUERY,
    { search: asked || q },
  );
  // our readers are in the US: only series with an official English title. A
  // novel goes by its novel name (lightNovel.ts), so it leads to its own page
  const hits = (media: Media[], novel: boolean) =>
    media
      .filter((m) => m.title.english)
      .map((m) => {
        const name = novel ? novelName(m.title.english!) : m.title.english!;
        return { m, name, novel };
      });
  const manga = hits(data.manga.media, false);
  const novels = hits(data.novel.media, true);
  const items = (
    novelsFirst ? withNovels(novels, manga) : withNovels(manga, novels)
  ).map(({ m, name, novel }) => ({
    name,
    slug: slugify(name),
    ...(novel ? { lightNovel: true } : {}),
    year: m.startDate?.year ?? null,
    score: m.averageScore ?? null,
    volumes: m.volumes ?? null,
    status: m.status,
    coverUrl: m.coverImage?.large ?? m.coverImage?.medium ?? null,
    thumbUrl: m.coverImage?.medium ?? null,
  }));

  searchCache.set(key, { at: Date.now(), items });
  if (searchCache.size > 1000) {
    searchCache.delete(searchCache.keys().next().value!);
  }
  return items;
}

const ENGLISH_NAME_QUERY = `
  query ($search: String, $format: MediaFormat) {
    Media(search: $search, type: MANGA, format: $format, sort: SEARCH_MATCH) {
      title { english }
    }
  }
`;
const englishNames = new Map<string, Promise<string | null>>();

// official English name for a Japanese series title ("葬送のフリーレン" ->
// "Frieren: Beyond Journey's End"). Resolves to null when AniList has no
// match, and rejects when AniList couldn't answer (rate limit, outage), so
// the caller can tell "no English name" from "couldn't check right now"
export function englishSeriesName(
  japanese: string,
  // a light novel's Japanese title: its novel's English name
  novel = false,
): Promise<string | null> {
  // the promise itself is cached, so many results asking about the same
  // Japanese name at once share one AniList request
  const key = `${novel ? "novel" : "manga"}:${japanese}`;
  const cached = englishNames.get(key);
  if (cached) return cached;
  const lookup = query<{ Media: { title: { english: string | null } } | null }>(
    ENGLISH_NAME_QUERY,
    { search: japanese, format: novel ? "NOVEL" : "MANGA" },
  )
    .then(({ Media }) => Media?.title?.english?.replace(/’/g, "'") ?? null)
    .catch((e: Error) => {
      // a 404 means no match: a real answer, kept cached
      if (/responded 404/.test(e.message)) return null;
      console.error("AniList name lookup failed:", e.message);
      englishNames.delete(key);
      throw e;
    });
  englishNames.set(key, lookup);
  return lookup;
}

let trending: { at: number; items: SeriesHit[] } = { at: 0, items: [] };

const TRENDING_QUERY = `
  query {
    Page(perPage: 30) {
      media(type: MANGA, sort: TRENDING_DESC, countryOfOrigin: "JP", isAdult: false) {
        id averageScore
        title { english romaji }
        coverImage { large }
      }
    }
  }
`;

// popular this season. Only series with an English title, which is a good
// sign they're licensed in the US and have volumes to price
export async function getTrending(): Promise<SeriesHit[]> {
  if (Date.now() - trending.at < TRENDING_FRESH_MS) return trending.items;
  try {
    const { Page } = await query<{ Page: { media: Media[] } }>(TRENDING_QUERY);
    const items = Page.media
      // all 30: the home page keeps the ones with English books (service.ts)
      .filter((m) => m.title.english)
      .map((m) => ({
        name: m.title.english!,
        slug: slugify(m.title.english!),
        coverUrl: m.coverImage?.large ?? null,
        score: m.averageScore ?? null,
      }));
    trending = { at: Date.now(), items };
  } catch (e) {
    console.error("AniList trending failed:", (e as Error).message);
  }
  return trending.items;
}

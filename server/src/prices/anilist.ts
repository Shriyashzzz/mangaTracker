// AniList: free, no key. Series score, popularity rank, genres and blurb,
// plus what's trending this season. Same numbers manga.london shows.
// https://docs.anilist.co (rate limit 30-90 requests a minute)
//
// Caches, from slowest to fastest to change:
//   series_info table  a week per series (getSeriesInfo)
//   memory             an hour per typed search, 6h for trending, the
//                      server's life for Japanese -> English names
import { prisma } from "../config/prisma.js";
import { slugify } from "./match.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { SeriesHit, SeriesInfo } from "./types.js";

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
  title: { english: string | null; romaji: string | null };
  coverImage: { large: string | null; medium?: string | null } | null;
  description: string | null;
  rankings: { rank: number; type: string; allTime: boolean }[] | null;
  startDate?: { year: number | null } | null;
};

async function query<T>(gql: string, variables?: Record<string, unknown>) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gql, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);
  const { data, errors } = (await res.json()) as {
    data: T;
    errors?: { message: string }[];
  };
  if (errors?.length) throw new Error(`AniList: ${errors[0]!.message}`);
  return data;
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
  "&amp;": "&", // last, so "&amp;lt;" becomes "&lt;" and not "<"
};
const decodeEntities = (text: string) =>
  Object.entries(ENTITIES).reduce(
    (out, [entity, char]) => out.replaceAll(entity, char),
    text,
  );

// AniList descriptions carry <br> and <i> tags and source notes
const plainText = (html: string | null) =>
  decodeEntities(
    (html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
  )
    .replace(/\(Source:[^)]*\)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1500);

const SERIES_QUERY = `
  query ($search: String) {
    Media(search: $search, type: MANGA, format: MANGA, sort: SEARCH_MATCH) {
      id siteUrl status volumes averageScore genres synonyms
      title { english romaji }
      coverImage { large }
      description(asHtml: false)
      rankings { rank type allTime }
    }
  }
`;

const toInfo = (m: Media): SeriesInfo => ({
  anilistId: m.id,
  name: (m.title.english || m.title.romaji) ?? "",
  score: m.averageScore ?? null,
  popularityRank:
    m.rankings?.find((r) => r.type === "POPULAR" && r.allTime)?.rank ?? null,
  genres: m.genres ?? [],
  description: plainText(m.description),
  coverUrl: m.coverImage?.large ?? null,
  siteUrl: m.siteUrl,
  status: m.status,
  volumes: m.volumes ?? null,
  // other names, e.g. Detective Conan is published in the US as Case Closed
  altNames: [m.title.romaji, ...(m.synonyms ?? [])].filter(
    (n): n is string => !!n && /^[\x20-\x7e’]+$/.test(n),
  ),
});

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
      AND trim(both '-' from
        regexp_replace(lower(info->>'name'), '[^a-z0-9]+', '-', 'g')) = ${slug}
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
  return rows.map((r) => r.info);
}

// series info, cached a week in the database so pages stay fast and we stay
// far inside AniList's rate limit. Returns null if AniList has no match
export async function getSeriesInfo(name: string): Promise<SeriesInfo | null> {
  const slug = slugify(name);
  if (!slug) return null;
  const cached = await prisma.seriesInfo.findUnique({ where: { slug } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < SERIES_FRESH_MS) {
    return cached.info as SeriesInfo | null;
  }

  try {
    const { Media } = await query<{ Media: Media | null }>(SERIES_QUERY, {
      search: name,
    });
    const info = Media ? toInfo(Media) : null;
    // Prisma needs DbNull (SQL NULL) rather than a JS null for a Json column
    const value = info ?? Prisma.DbNull;
    await prisma.seriesInfo.upsert({
      where: { slug },
      create: { slug, info: value, fetchedAt: new Date() },
      update: { info: value, fetchedAt: new Date() },
    });
    return info;
  } catch (e) {
    // a stale answer beats none if AniList is down or rate limiting us
    console.error("AniList series lookup failed:", (e as Error).message);
    return (cached?.info as SeriesInfo | null) ?? null;
  }
}

const SEARCH_QUERY = `
  query ($search: String) {
    Page(perPage: 20) {
      media(search: $search, type: MANGA, format: MANGA, sort: SEARCH_MATCH, isAdult: false) {
        id averageScore volumes status
        title { english romaji }
        startDate { year }
        coverImage { large medium }
      }
    }
  }
`;

const searchCache = new Map<string, { at: number; items: SeriesHit[] }>();

// series matching what someone typed (the home page typeahead)
export async function searchSeries(q: string): Promise<SeriesHit[]> {
  const key = q.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_FRESH_MS) return hit.items;

  const { Page } = await query<{ Page: { media: Media[] } }>(SEARCH_QUERY, {
    search: q,
  });
  // our readers are in the US: only series with an official English title
  const items = Page.media
    .filter((m) => m.title.english)
    .map((m) => ({
      name: m.title.english!,
      slug: slugify(m.title.english!),
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
  query ($search: String) {
    Media(search: $search, type: MANGA, format: MANGA, sort: SEARCH_MATCH) {
      title { english }
    }
  }
`;
const englishNames = new Map<string, Promise<string | null>>();

// official English name for a Japanese series title ("葬送のフリーレン" ->
// "Frieren: Beyond Journey's End"). Resolves to null when AniList has no
// match, and rejects when AniList couldn't answer (rate limit, outage), so
// the caller can tell "no English name" from "couldn't check right now"
export function englishSeriesName(japanese: string): Promise<string | null> {
  // the promise itself is cached, so many results asking about the same
  // Japanese name at once share one AniList request
  const cached = englishNames.get(japanese);
  if (cached) return cached;
  const lookup = query<{ Media: { title: { english: string | null } } | null }>(
    ENGLISH_NAME_QUERY,
    { search: japanese },
  )
    .then(({ Media }) => Media?.title?.english?.replace(/’/g, "'") ?? null)
    .catch((e: Error) => {
      // a 404 means no match: a real answer, kept cached
      if (/responded 404/.test(e.message)) return null;
      console.error("AniList name lookup failed:", e.message);
      englishNames.delete(japanese);
      throw e;
    });
  englishNames.set(japanese, lookup);
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
      .filter((m) => m.title.english)
      .slice(0, 12)
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

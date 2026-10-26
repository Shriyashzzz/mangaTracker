import { pool } from "../models/pool.js";

// AniList: free, no key. Series score, popularity rank, genres and blurb,
// plus what's trending this season. Same numbers manga.london shows.
// https://docs.anilist.co (rate limit 30-90 requests a minute)
const URL = "https://graphql.anilist.co";
const SERIES_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const TRENDING_FRESH_MS = 6 * 60 * 60 * 1000;

export const slugify = (name) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

async function query(gql, variables) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gql, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(`AniList: ${errors[0].message}`);
  return data;
}

// AniList descriptions carry <br> and <i> tags and source notes
// the HTML escapes AniList uses in plain-text descriptions
const ENTITIES = {
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
const decodeEntities = (text) =>
  Object.entries(ENTITIES).reduce(
    (out, [entity, char]) => out.replaceAll(entity, char),
    text,
  );

const plainText = (html) =>
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

const toInfo = (m) => ({
  anilistId: m.id,
  name: m.title.english || m.title.romaji,
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
    (n) => n && /^[\x20-\x7e’]+$/.test(n),
  ),
});

// A series address can be just the slug of AniList's name
// (/prices/series/frieren-beyond-journey-s-end), which reaches us as
// "frieren beyond journey s end". If a series we've seen has that slug,
// this gives back its real name; otherwise the name as it came
export async function knownSeriesName(name) {
  const slug = slugify(name);
  if (!slug) return name;
  const { rows } = await pool.query(
    `
    SELECT info->>'name' AS name FROM series_info
    WHERE info IS NOT NULL
      AND trim(both '-' from
        regexp_replace(lower(info->>'name'), '[^a-z0-9]+', '-', 'g')) = $1
    ORDER BY fetched_at DESC
    LIMIT 1
    `,
    [slug],
  );
  return rows[0]?.name ?? name;
}

// series info, cached a week in the database so pages stay fast and we stay
// far inside AniList's rate limit. Returns null if AniList has no match
export async function getSeriesInfo(name) {
  const slug = slugify(name);
  if (!slug) return null;
  const { rows } = await pool.query(
    `SELECT info, fetched_at FROM series_info WHERE slug = $1`,
    [slug],
  );
  const cached = rows[0];
  if (cached && Date.now() - cached.fetched_at < SERIES_FRESH_MS) {
    return cached.info;
  }

  try {
    const { Media } = await query(SERIES_QUERY, { search: name });
    const info = Media ? toInfo(Media) : null;
    await pool.query(
      `
      INSERT INTO series_info (slug, info, fetched_at) VALUES ($1, $2, now())
      ON CONFLICT (slug) DO UPDATE SET info = EXCLUDED.info, fetched_at = now()
      `,
      [slug, info],
    );
    return info;
  } catch (e) {
    // a stale answer beats none if AniList is down or rate limiting us
    console.error("AniList series lookup failed:", e.message);
    return cached?.info ?? null;
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

const searchCache = new Map();
const SEARCH_FRESH_MS = 60 * 60 * 1000;

// series matching what someone typed
export async function searchSeries(q) {
  const key = q.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_FRESH_MS) return hit.items;

  const { Page } = await query(SEARCH_QUERY, { search: q });
  // our readers are in the US: only series with an official English title
  const items = Page.media
    .filter((m) => m.title.english)
    .map((m) => ({
      name: m.title.english,
      slug: slugify(m.title.english),
      year: m.startDate?.year ?? null,
      score: m.averageScore ?? null,
      volumes: m.volumes ?? null,
      status: m.status,
      coverUrl: m.coverImage?.large ?? m.coverImage?.medium ?? null,
      thumbUrl: m.coverImage?.medium ?? null,
    }));

  searchCache.set(key, { at: Date.now(), items });
  if (searchCache.size > 1000) {
    searchCache.delete(searchCache.keys().next().value);
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
const englishNames = new Map();

// official English name for a Japanese series title ("葬送のフリーレン" ->
// "Frieren: Beyond Journey's End"), or null. Cached for the server's life
// resolves to the English name, or null when AniList has no match. Rejects
// when AniList couldn't answer (rate limit, outage), so the caller can tell
// "no English name" from "couldn't check right now"
export function englishSeriesName(japanese) {
  // the promise itself is cached, so many results asking about the same
  // Japanese name at once share one AniList request
  if (englishNames.has(japanese)) return englishNames.get(japanese);
  const lookup = query(ENGLISH_NAME_QUERY, { search: japanese })
    .then(({ Media }) => Media?.title?.english?.replace(/’/g, "'") ?? null)
    .catch((e) => {
      // a 404 means no match: a real answer, kept cached
      if (/responded 404/.test(e.message)) return null;
      console.error("AniList name lookup failed:", e.message);
      englishNames.delete(japanese);
      throw e;
    });
  englishNames.set(japanese, lookup);
  return lookup;
}

let trending = { at: 0, items: [] };

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
export async function getTrending() {
  if (Date.now() - trending.at < TRENDING_FRESH_MS) return trending.items;
  try {
    const { Page } = await query(TRENDING_QUERY);
    const items = Page.media
      .filter((m) => m.title.english)
      .slice(0, 12)
      .map((m) => ({
        name: m.title.english,
        slug: slugify(m.title.english),
        coverUrl: m.coverImage?.large ?? null,
        score: m.averageScore ?? null,
      }));
    trending = { at: Date.now(), items };
  } catch (e) {
    console.error("AniList trending failed:", e.message);
  }
  return trending.items;
}

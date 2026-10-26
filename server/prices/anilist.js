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
const plainText = (html) =>
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\(Source:[^)]*\)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1500);

const SERIES_QUERY = `
  query ($search: String) {
    Media(search: $search, type: MANGA, format: MANGA, sort: SEARCH_MATCH) {
      id siteUrl status volumes averageScore genres
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
});

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

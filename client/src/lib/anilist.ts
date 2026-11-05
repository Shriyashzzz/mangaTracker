// AniList's public GraphQL API: free, no key, ~30-90 requests a minute
const ANILIST_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
  query ($search: String) {
    Page(perPage: 6) {
      media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
        id
        format
        title { english romaji }
        startDate { year }
        coverImage { extraLarge large }
        genres
        tags { name rank isMediaSpoiler }
      }
    }
  }
`;

// AniList tags that name one of our genres outright. AniList tags almost
// everything with something, so most need a high rank (0-100) to count;
// the ones that define a series whenever they show up get a lower bar
type Tag = { name: string; rank: number; isMediaSpoiler: boolean };

export type CoverHit = {
  id: number;
  title: string;
  year: number | null;
  cover: string;
  genre: string;
  lightNovel: boolean;
};

const TAG_GENRES: Record<string, { genre: string; minRank: number }> = {
  Isekai: { genre: "Isekai", minRank: 65 },
  Food: { genre: "Gourmet", minRank: 75 },
  Cooking: { genre: "Gourmet", minRank: 75 },
  Superhero: { genre: "Superhero", minRank: 80 },
  Cyberpunk: { genre: "Cyberpunk", minRank: 90 },
  Steampunk: { genre: "Steampunk", minRank: 90 },
  "Post-Apocalyptic": { genre: "Post-Apocalyptic", minRank: 90 },
  Dystopian: { genre: "Dystopian", minRank: 90 },
  Military: { genre: "Military", minRank: 90 },
  Historical: { genre: "Historical", minRank: 90 },
  "Female Harem": { genre: "Harem", minRank: 90 },
  "Male Harem": { genre: "Harem", minRank: 90 },
};

// AniList genres in the order we'd rather show them, the broad ones last
const GENRE_PRIORITY: [anilist: string, ours: string][] = [
  ["Mahou Shoujo", "Magical Girl"],
  ["Mecha", "Mecha"],
  ["Sports", "Sports"],
  ["Horror", "Horror"],
  ["Romance", "Romance"],
  ["Mystery", "Mystery"],
  ["Sci-Fi", "Sci-Fi"],
  ["Thriller", "Thriller"],
  ["Supernatural", "Supernatural"],
  ["Slice of Life", "Slice of Life"],
  ["Adventure", "Adventure"],
  ["Action", "Action"],
  ["Comedy", "Comedy"],
  ["Fantasy", "Fantasy"],
  ["Drama", "Drama"],
  ["Ecchi", "Ecchi"],
];

// picks the one genre from lib/content/genres.js that best describes an AniList entry
export function pickGenre(genres: string[] = [], tags: Tag[] = []) {
  const has = (g: string) => genres.includes(g);
  if (has("Mahou Shoujo")) return "Magical Girl";

  const isekai = tags.find((t) => t.name === "Isekai");
  if (isekai && isekai.rank >= TAG_GENRES.Isekai!.minRank) return "Isekai";

  if (has("Fantasy") && has("Horror")) return "Dark Fantasy";
  if (has("Psychological") && has("Thriller")) return "Psychological Thriller";

  // otherwise the strongest qualifying tag wins
  const tagHit = tags
    .filter(
      (t) =>
        !t.isMediaSpoiler &&
        TAG_GENRES[t.name] !== undefined &&
        t.rank >= TAG_GENRES[t.name]!.minRank,
    )
    .sort((x, y) => y.rank - x.rank)[0];
  if (tagHit) return TAG_GENRES[tagHit.name]!.genre;

  const genreHit = GENRE_PRIORITY.find(([g]) => has(g));
  return genreHit ? genreHit[1] : "";
}

// returns [{ id, title, year, cover, genre }], throws on network / rate limit errors
export async function searchCovers(
  search: string,
  signal?: AbortSignal,
): Promise<CoverHit[]> {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search } }),
    signal,
  });
  if (!response.ok) throw new Error(`AniList responded ${response.status}`);

  type Media = {
    id: number;
    format?: string | null;
    title: { english: string | null; romaji: string };
    startDate?: { year: number | null };
    coverImage?: { extraLarge?: string; large?: string };
    genres?: string[];
    tags?: Tag[];
  };
  const { data } = (await response.json()) as {
    data?: { Page?: { media?: Media[] } };
  };
  return (data?.Page?.media ?? [])
    .filter((m) => m.coverImage?.large)
    .map((m) => ({
      id: m.id,
      title: m.title.english || m.title.romaji,
      year: m.startDate?.year ?? null,
      cover: (m.coverImage!.extraLarge || m.coverImage!.large)!,
      genre: pickGenre(m.genres, m.tags),
      lightNovel: m.format === "NOVEL",
    }));
}

// ---------- matching an imported series ----------

// a light novel only when the book says so: otherwise a novel by the same name
// would win over the manga. Five results, not one: AniList's top result for
// "Fairy Tail" can be something else that mentions it (matchFrom picks)
const MATCH_QUERY = `
  query ($search: String, $novel: Boolean!) {
    manga: Page(perPage: 5) @skip(if: $novel) {
      media(search: $search, type: MANGA, format_not: NOVEL, sort: SEARCH_MATCH) {
        ...match
      }
    }
    novel: Page(perPage: 5) @include(if: $novel) {
      media(search: $search, type: MANGA, format: NOVEL, sort: SEARCH_MATCH) {
        ...match
      }
    }
  }
  fragment match on Media {
    id
    idMal
    popularity
    synonyms
    title { english romaji native }
    coverImage { extraLarge large }
  }
`;

export type MatchCandidate = {
  id: number;
  idMal: number | null;
  popularity: number | null;
  synonyms: string[] | null;
  title: {
    english: string | null;
    romaji: string | null;
    native: string | null;
  };
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
};

// names compared without case, spacing or punctuation. "×" is "x", "&" is
// "and", a leading "The" or "A" doesn't count, and long vowels are spelt the
// way AniList's romaji spells them: "Fushigi Yûgi" is "Fushigi Yuugi"
const plain = (name: string) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ûū]/g, "uu")
    .replace(/[ôō]/g, "ou")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFKC")
    .replace(/×/g, "x")
    .replace(/&/g, " and ")
    .replace(/^\s*(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

// a guess is only trusted when one name starts with the other, and they share
// at least this much: "Crying Freeman: Portrait of a Killer" is Crying Freeman,
// but "Saga" isn't "New Saga" and "Rave" isn't "Rave!! Betrayal"
const SHARED_AT_LEAST = 5;

const namesOf = (m: MatchCandidate) =>
  [
    m.title.english,
    m.title.romaji,
    m.title.native,
    ...(m.synonyms ?? []),
  ].filter((n): n is string => Boolean(n));
const titlesOf = (m: MatchCandidate) => namesOf(m).map(plain).filter(Boolean);

// "Chunchu: The Genocide Fiend" carries on from "Chunchu" after a colon, so
// it's that series with its subtitle; "Justice Now!" just carries on, so it's
// another title that happens to start the same
const SUBTITLE_MARK = /^[\s]*[:\-–—/(~|]/;
// or only says what it is: "RWBY: The Official" + "Manga"
const JUST_THE_FORMAT = /^(the)?(manga|comics?|graphicnovel)$/;
function subtitleAfter(name: string, wanted: string) {
  // the original name, read until it has said as much as the search
  for (let i = 0; i < name.length; i++) {
    const said = plain(name.slice(0, i + 1));
    if (said.length >= wanted.length) {
      const rest = name.slice(i + 1);
      return (
        said === wanted &&
        // "Negima!" goes on as "Negima! Magister Negi Magi"
        (SUBTITLE_MARK.test(rest) ||
          /^[!?.]/.test(rest) ||
          JUST_THE_FORMAT.test(plain(rest)))
      );
    }
  }
  return false;
}

const morePopular = (a: MatchCandidate, b: MatchCandidate) =>
  (b.popularity ?? 0) > (a.popularity ?? 0) ? b : a;

// the one that's called exactly that (any of its titles), the most popular if
// several are. Failing that, the one whose name the search starts with, or that
// starts with the search, sharing the most; never anything else AniList offers
export function matchFrom(
  search: string,
  results: MatchCandidate[],
  exactOnly = false,
) {
  const wanted = plain(search);
  const exact = results.filter((m) => titlesOf(m).includes(wanted));
  let best = exact.length ? exact.reduce(morePopular) : undefined;
  // not called exactly that: the series is the search cut short ("Dance in
  // the Vampire Bund" for "…: Forgotten Tales", so maybe a spin-off it isn't)
  // or the search is the series cut short ("Chunchu" for "Chunchu: The
  // Genocide Fiend")
  let fit: "exact" | "parent" | "longer" = "exact";
  if (!best && !exactOnly && wanted.length >= SHARED_AT_LEAST) {
    let shared = 0;
    for (const m of results) {
      for (const name of namesOf(m)) {
        const t = plain(name);
        if (t.length < SHARED_AT_LEAST) continue;
        // the search is that name plus a subtitle, or that name is the search
        // plus a subtitle
        const fits =
          (wanted.startsWith(t) && t !== wanted) ||
          (t.startsWith(wanted) && subtitleAfter(name, wanted));
        const length = Math.min(t.length, wanted.length);
        // as good a fit as the last: the more popular one
        const better =
          length > shared ||
          (length === shared &&
            best &&
            (m.popularity ?? 0) > (best.popularity ?? 0));
        if (fits && better) {
          shared = length;
          best = m;
          fit = wanted.startsWith(t) ? "parent" : "longer";
        }
      }
    }
  }
  return best
    ? {
        anilistId: best.id,
        malId: best.idMal,
        name: best.title.english || best.title.romaji || search,
        cover: best.coverImage?.extraLarge || best.coverImage?.large || null,
        fit,
      }
    : null;
}

// AniList's own limit, from the headers on its last answer: how long to leave
// between lookups so a long import never runs into it
let limit = { perMinute: 30, remaining: 30, resetAt: 0 };
export function aniListGapMs() {
  if (limit.remaining <= 1 && limit.resetAt > Date.now())
    return limit.resetAt - Date.now() + 500;
  return Math.ceil(60_000 / Math.max(limit.perMinute, 1)) + 100;
}
const readLimit = (headers: Headers) => {
  const perMinute = Number(headers.get("X-RateLimit-Limit"));
  const remaining = Number(headers.get("X-RateLimit-Remaining"));
  const reset = Number(headers.get("X-RateLimit-Reset"));
  if (perMinute > 0) {
    limit = {
      perMinute,
      remaining: Number.isFinite(remaining) ? remaining : perMinute,
      resetAt: reset > 0 ? reset * 1000 : 0,
    };
  }
};

export class AniListBusy extends Error {
  waitSeconds: number;
  // no answer came back at all: the stricter limit, or no connection
  unreachable: boolean;
  constructor(waitSeconds: number, unreachable = false) {
    super("AniList asked us to slow down");
    this.waitSeconds = waitSeconds;
    this.unreachable = unreachable;
  }
}

// Latin accents only, so Japanese keeps its voiced marks
const withoutAccents = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFKC");
// a long vowel the way AniList's romaji often spells it: "Sajō" is "Sajou".
// Only a second try, as plenty are spelt without it ("Tokyo", "Ookami")
const LONG_VOWEL = /[ōôūûŌÔŪÛ]/;
const withLongVowels = (text: string) =>
  text
    .replace(/[ōô]/g, "ou")
    .replace(/[ŌÔ]/g, "Ou")
    .replace(/[ūû]/g, "uu")
    .replace(/[ŪÛ]/g, "Uu");

// one search, as given
async function searchOnce(
  search: string,
  signal?: AbortSignal,
  novel = false,
): Promise<MatchCandidate[] | null> {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    // AniList's search finds "Fushigi Yugi" but nothing for "Fushigi Yûgi"
    body: JSON.stringify({
      query: MATCH_QUERY,
      variables: { search, novel },
    }),
    signal,
  }).catch((e: unknown) => {
    if (signal?.aborted) throw e;
    // AniList's stricter "slow down" (a minute) comes without the header that
    // lets a browser read it, so it arrives as a failed request: wait it out
    throw new AniListBusy(60, true);
  });
  readLimit(response.headers);
  if (response.status === 429) {
    throw new AniListBusy(Number(response.headers.get("Retry-After")) || 30);
  }
  if (response.status === 404) return [];
  // AniList having a moment: worth waiting a little, like a "slow down"
  if (response.status >= 500) throw new AniListBusy(15);
  if (!response.ok) throw new Error(`AniList responded ${response.status}`);
  const { data } = (await response.json()) as {
    data?: Record<
      "manga" | "novel",
      { media: MatchCandidate[] } | null | undefined
    >;
  };
  return (novel ? data?.novel : data?.manga)?.media ?? [];
}

// AniList's top five for a name, manga or light novels. Throws AniListBusy
// when it asks to slow down (or can't be reached)
export async function searchManga(
  search: string,
  signal?: AbortSignal,
  novel = false,
): Promise<MatchCandidate[] | null> {
  const first = await searchOnce(withoutAccents(search), signal, novel);
  if (first?.length || !LONG_VOWEL.test(search)) return first;
  // a second request: at AniList's pace, like any other
  await new Promise((done) => setTimeout(done, aniListGapMs()));
  if (signal?.aborted) return first;
  return searchOnce(withoutAccents(withLongVowels(search)), signal, novel);
}

// the manga (or light novel) a series name most likely is, with its MyAnimeList
// id so the server can fetch its cover and genre. Null when AniList has nothing
// by that name, which for a book app's export usually means it isn't manga
export async function findManga(
  search: string,
  signal?: AbortSignal,
  novel = false,
  // only something called exactly that, not AniList's best guess
  exactOnly = false,
) {
  const results = await searchManga(search, signal, novel);
  return matchFrom(search, results ?? [], exactOnly);
}

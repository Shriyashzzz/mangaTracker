// Importing a public list straight from AniList or Kitsu by username: no file,
// just their own public APIs, asked from the browser. Both come out the same
// shape as a MyAnimeList export, so the rest of the import is shared.
import type { MalEntry, MalItem } from "./malImport";
import { ImportFileError } from "./malImport";

export type AccountSource = "anilist" | "kitsu";

// AniList and Kitsu statuses, as the MyAnimeList lists the import page shows
const AS_MAL: Record<string, string> = {
  CURRENT: "Reading",
  REPEATING: "Reading",
  COMPLETED: "Completed",
  PAUSED: "On-Hold",
  DROPPED: "Dropped",
  PLANNING: "Plan to Read",
  current: "Reading",
  completed: "Completed",
  on_hold: "On-Hold",
  dropped: "Dropped",
  planned: "Plan to Read",
};

const whole = (n: unknown, max: number) =>
  Math.min(Math.max(Math.floor(Number(n) || 0), 0), max);

const entry = (fields: {
  malId?: number | null;
  title: string;
  status: string;
  chapters: unknown;
  readVolumes: unknown;
  ownedVolumes: unknown;
  score: unknown;
  notes?: string | null;
  cover?: string | null;
}): MalItem => {
  const status = AS_MAL[fields.status] ?? "Reading";
  const e: MalEntry = {
    ...(fields.malId ? { malId: fields.malId } : {}),
    title: fields.title.slice(0, 300),
    finished: status === "Completed",
    chapters: whole(fields.chapters, 100000),
    readVolumes: whole(fields.readVolumes, 999),
    ownedVolumes: whole(fields.ownedVolumes, 999),
    score: whole(fields.score, 10),
    ...(fields.notes?.trim() ? { comments: fields.notes.trim() } : {}),
    ...(fields.cover ? { cover: fields.cover } : {}),
  };
  return { status, entry: e };
};

// ---------- AniList ----------

const ANILIST_LIST = `
  query ($name: String) {
    MediaListCollection(userName: $name, type: MANGA) {
      lists {
        isCustomList
        entries {
          status
          score(format: POINT_10)
          progress
          progressVolumes
          notes
          media {
            id
            idMal
            title { english romaji }
            coverImage { large }
          }
        }
      }
    }
  }
`;

type AniListEntry = {
  status: string;
  score: number;
  progress: number;
  progressVolumes: number;
  notes: string | null;
  media: {
    id: number;
    idMal: number | null;
    title: { english: string | null; romaji: string };
    coverImage?: { large?: string };
  };
};

export async function readAniList(name: string): Promise<MalItem[]> {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: ANILIST_LIST, variables: { name } }),
  });
  if (response.status === 429) {
    throw new ImportFileError(
      "AniList is busy right now. Wait a minute and try again.",
    );
  }
  const body = (await response.json().catch(() => null)) as {
    errors?: { message: string }[];
    data?: {
      MediaListCollection?: {
        lists: { isCustomList: boolean; entries: AniListEntry[] }[];
      };
    };
  } | null;
  const problem = body?.errors?.[0]?.message ?? "";
  if (/private/i.test(problem)) {
    throw new ImportFileError(
      "That list is private. On AniList, make your list public in Settings, then try again.",
    );
  }
  if (/not found/i.test(problem)) {
    throw new ImportFileError(
      "There's no AniList account with that name. Check the spelling.",
    );
  }
  if (!response.ok || !body?.data) {
    throw new ImportFileError("AniList didn't answer. Try again in a moment.");
  }
  // custom lists repeat what's already in the status lists
  const seen = new Set<number>();
  return (body.data.MediaListCollection?.lists ?? [])
    .filter((list) => !list.isCustomList)
    .flatMap((list) => list.entries)
    .filter((e) => !seen.has(e.media.id) && seen.add(e.media.id))
    .map((e) =>
      entry({
        malId: e.media.idMal,
        title: e.media.title.english || e.media.title.romaji,
        status: e.status,
        chapters: e.progress,
        readVolumes: e.progressVolumes,
        ownedVolumes: 0,
        score: e.score,
        notes: e.notes,
        cover: e.media.coverImage?.large,
      }),
    );
}

// ---------- Kitsu ----------

const KITSU = "https://kitsu.app/api/edge";
// a whole library, a page at a time; past this it's not a person's list
const KITSU_MAX_PAGES = 40;

type Resource = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data: { id: string } | { id: string }[] | null }>;
};
type JsonApi = { data: Resource[]; included?: Resource[]; links?: { next?: string } };

const kitsuGet = async (url: string): Promise<JsonApi> => {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!response.ok)
    throw new ImportFileError("Kitsu didn't answer. Try again in a moment.");
  return (await response.json()) as JsonApi;
};

const kitsuUser = async (name: string) => {
  for (const filter of ["slug", "name"]) {
    const found = await kitsuGet(
      `${KITSU}/users?filter[${filter}]=${encodeURIComponent(name)}&fields[users]=slug`,
    );
    if (found.data[0]) return found.data[0].id;
  }
  throw new ImportFileError(
    "There's no Kitsu account with that name. Check the spelling.",
  );
};

export async function readKitsu(name: string): Promise<MalItem[]> {
  const userId = await kitsuUser(name);
  const items: MalItem[] = [];
  let next: string | undefined =
    `${KITSU}/library-entries?filter[userId]=${userId}&filter[kind]=manga` +
    "&include=manga,manga.mappings" +
    "&fields[libraryEntries]=status,progress,volumesOwned,ratingTwenty,notes,manga" +
    "&fields[manga]=canonicalTitle,titles,posterImage,mappings" +
    "&fields[mappings]=externalSite,externalId&page[limit]=100";
  for (let page = 0; next && page < KITSU_MAX_PAGES; page++) {
    const body = await kitsuGet(next);
    const included = new Map(
      (body.included ?? []).map((i) => [`${i.type}:${i.id}`, i]),
    );
    for (const row of body.data) {
      const a = row.attributes;
      const mangaRef = row.relationships?.manga?.data as { id: string } | null;
      const manga = mangaRef ? included.get(`manga:${mangaRef.id}`) : undefined;
      if (!manga) continue;
      const m = manga.attributes;
      const titles = (m.titles ?? {}) as Record<string, string>;
      const mappings = (
        (manga.relationships?.mappings?.data ?? []) as { id: string }[]
      )
        .map((ref) => included.get(`mappings:${ref.id}`)?.attributes)
        .filter(Boolean) as { externalSite: string; externalId: string }[];
      const mal = mappings.find((x) => x.externalSite === "myanimelist/manga");
      items.push(
        entry({
          malId: mal ? Number(mal.externalId) || null : null,
          title: titles.en || String(m.canonicalTitle ?? ""),
          status: String(a.status),
          chapters: a.progress,
          readVolumes: 0,
          ownedVolumes: a.volumesOwned,
          // out of 20 on Kitsu, out of 10 here
          score: Math.round((Number(a.ratingTwenty) || 0) / 2),
          notes: a.notes as string | null,
          cover: ((m.posterImage ?? {}) as { large?: string }).large,
        }),
      );
    }
    next = body.links?.next;
  }
  return items.filter((item) => item.entry.title);
}

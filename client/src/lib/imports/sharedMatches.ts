// Matches shared by everyone's imports (server: util/shelf/sharedMatches.ts).
// Before matching, the import asks which of its titles are known already;
// those skip AniList entirely. Afterwards it tells the server the matches it
// found, which the server checks with AniList before anyone else gets them.
// Both are only a help: if the server can't answer, matching asks AniList
import { apiFetch } from "../api";

export type SharedSearch = {
  name: string;
  lightNovel: boolean;
  exactOnly: boolean;
};
export type SharedMatch = {
  anilistId: number;
  malId: number | null;
  name: string;
  cover: string | null;
};

// what the server takes in one go
const PER_REQUEST = 500;
// the longest title it takes: a longer one (a 400-character row) is never
// sent, or the server turns the whole request away and every title waits
// on AniList
const LONGEST_NAME = 200;
const fits = (search: SharedSearch) => {
  const length = search.name.trim().length;
  return length >= 1 && length <= LONGEST_NAME;
};
// a server that's up but stuck mustn't hold the import at "0 of 442": past
// this, matching goes on with AniList as if nothing were known
const ASK_TIMEOUT_MS = 8000;

// stopped by them (Stop import), or out of time
const askSignal = (signal?: AbortSignal) => {
  const timeout = AbortSignal.timeout(ASK_TIMEOUT_MS);
  return signal && "any" in AbortSignal
    ? AbortSignal.any([signal, timeout])
    : timeout;
};

// the known match for each search, in the same order; null for not known
export async function askShared(
  searches: SharedSearch[],
  signal?: AbortSignal,
): Promise<(SharedMatch | null)[]> {
  // only the ones the server takes are asked; the rest are not known
  const asked = searches.filter(fits);
  const known = new Map<SharedSearch, SharedMatch | null>();
  let answering = true;
  for (let i = 0; i < asked.length; i += PER_REQUEST) {
    const part = asked.slice(i, i + PER_REQUEST);
    // one that didn't answer: the rest aren't asked
    const res = answering
      ? await apiFetch("/api/manga/import/matches", {
          method: "POST",
          body: { searches: part },
          signal: askSignal(signal),
        }).catch(() => null)
      : null;
    const matches = res?.ok
      ? (
          (await res.json().catch(() => null)) as {
            matches?: unknown;
          } | null
        )?.matches
      : null;
    if (!res) answering = false;
    // not answered: these just go to AniList
    const answered =
      Array.isArray(matches) && matches.length === part.length
        ? (matches as (SharedMatch | null)[])
        : part.map(() => null);
    part.forEach((search, n) => known.set(search, answered[n]));
  }
  return searches.map((search) => known.get(search) ?? null);
}

export function tellShared(
  everyFound: (SharedSearch & { anilistId: number })[],
) {
  const found = everyFound.filter(fits);
  for (let i = 0; i < found.length; i += PER_REQUEST) {
    void apiFetch("/api/manga/import/matches/found", {
      method: "POST",
      body: { matches: found.slice(i, i + PER_REQUEST) },
    }).catch(() => {});
  }
}

// a series they picked by hand for one of their titles (Edit), or null when
// they undid it: theirs on every later import, on any device, and a vote
// toward everyone's (server: util/shelf/importPicks.ts). Only a help: if it
// doesn't arrive, this import still has it
export function tellPick(search: SharedSearch, match: SharedMatch | null) {
  if (!fits(search)) return;
  void apiFetch("/api/manga/import/picks", {
    method: "POST",
    body: { search, match },
  }).catch(() => {});
}

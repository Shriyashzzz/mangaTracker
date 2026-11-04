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
  const out: (SharedMatch | null)[] = [];
  let answering = true;
  for (let i = 0; i < searches.length; i += PER_REQUEST) {
    const part = searches.slice(i, i + PER_REQUEST);
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
    out.push(
      ...(Array.isArray(matches) && matches.length === part.length
        ? (matches as (SharedMatch | null)[])
        : part.map(() => null)),
    );
  }
  return out;
}

export function tellShared(found: (SharedSearch & { anilistId: number })[]) {
  for (let i = 0; i < found.length; i += PER_REQUEST) {
    void apiFetch("/api/manga/import/matches/found", {
      method: "POST",
      body: { matches: found.slice(i, i + PER_REQUEST) },
    }).catch(() => {});
  }
}

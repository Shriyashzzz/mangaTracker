// The rules for changes made offline, with nothing that needs a browser, so
// the server's Jest can test them (lib/offlineChanges.ts keeps the changes
// on the device and sends them).
//
// Each series keeps one change of each kind, however many taps went into
// it: where it started (the first tap's "before") and where it ended up (the
// last tap's "after"). The server applies only what changed between the two
// (server/src/offline/offlineRules.ts).
import { ownedVolumes } from "./ownedVolumes";
import type { Manga } from "./types";

export type PlaceKind = "bookmark" | "readVolume";
export type OfflineChange = { key: string; mangaId: number; at: number } & (
  | { kind: "owned"; started: number[]; ended: number[] }
  | { kind: PlaceKind; from: number | null; to: number | null }
);

// another tap on a series' shelf, put with the change already waiting: the
// first one's start, this one's end
export function combinedOwned(
  had: OfflineChange | undefined,
  mangaId: number,
  started: number[],
  ended: number[],
  at: number,
): OfflineChange {
  return {
    key: `${mangaId}:owned`,
    mangaId,
    kind: "owned",
    started: had?.kind === "owned" ? had.started : started,
    ended,
    at,
  };
}

// the chapter or volume read moved again: the first move's "from", this
// one's "to"
export function combinedPlace(
  had: OfflineChange | undefined,
  mangaId: number,
  kind: PlaceKind,
  from: number | null,
  to: number | null,
  at: number,
): OfflineChange {
  return {
    key: `${mangaId}:${kind}`,
    mangaId,
    kind,
    from: had && had.kind === kind ? had.from : from,
    to,
    at,
  };
}

// a series as it is on this device: with its waiting changes on it
export function withChanges(manga: Manga, changes: OfflineChange[]): Manga {
  let shown = manga;
  for (const change of changes) {
    if (change.mangaId !== manga.id) continue;
    if (change.kind === "owned")
      shown = { ...shown, ...ownedVolumes(null, change.ended) };
    else if (change.kind === "bookmark")
      shown = { ...shown, bookmark: change.to };
    else shown = { ...shown, readVolume: change.to };
  }
  return shown;
}

// a change as the server takes it: what's kept only on this device left
// off. (public/sw.js has the same, for sending with the app closed)
export const toSend = (change: OfflineChange) =>
  change.kind === "owned"
    ? {
        kind: change.kind,
        mangaId: change.mangaId,
        started: change.started,
        ended: change.ended,
      }
    : {
        kind: change.kind,
        mangaId: change.mangaId,
        from: change.from,
        to: change.to,
      };

// "Saved 3 changes made offline." A refused one can never save: its series
// was deleted on another device, or the chapter is past the newest out
export function sentNote(saved: number, refused: number) {
  const many = (n: number) => (n === 1 ? "1 change" : `${n} changes`);
  if (!refused) return `Saved ${many(saved)} made offline.`;
  const not = `${many(refused)} made offline couldn't be saved.`;
  return saved ? `Saved ${many(saved)}. ${not}` : not;
}

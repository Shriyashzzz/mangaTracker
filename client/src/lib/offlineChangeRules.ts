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
// what else can wait: finished or not, To read, the rating and the notes
export type ValueKind = "status" | "planned" | "rating" | "notes";
export type ChangeKind = PlaceKind | ValueKind;
export type ChangeValue = number | boolean | string | null;
export type OfflineChange = { key: string; mangaId: number; at: number } & (
  | { kind: "owned"; started: number[]; ended: number[] }
  | { kind: ChangeKind; from: ChangeValue; to: ChangeValue }
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

// the chapter, the volume read, finished, To read, the rating or the notes
// changed again: the first change's "from", this one's "to". (Back where it
// started is nothing to send: lib/offlineChanges.ts drops it)
export function combinedChange(
  had: OfflineChange | undefined,
  mangaId: number,
  kind: ChangeKind,
  from: ChangeValue,
  to: ChangeValue,
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

// a change with nothing in it: back where it started
export const changesNothing = (change: OfflineChange) =>
  change.kind !== "owned" && change.from === change.to;

// in the order they were made, which is how the server applies them
// (finishing a series takes it off To read, so the order matters)
export const inOrder = (changes: OfflineChange[]) =>
  [...changes].sort((a, b) => a.at - b.at);

// a series as it is on this device: with its waiting changes on it, as the
// server will save them (server models/mangaQueries.ts setStatus, setPlanned)
export function withChanges(manga: Manga, changes: OfflineChange[]): Manga {
  let shown = manga;
  for (const change of inOrder(changes)) {
    if (change.mangaId !== manga.id) continue;
    if (change.kind === "owned") {
      shown = { ...shown, ...ownedVolumes(null, change.ended) };
      continue;
    }
    const to = change.to;
    if (change.kind === "bookmark")
      shown = { ...shown, bookmark: to as number };
    else if (change.kind === "readVolume")
      shown = { ...shown, readVolume: to as number | null };
    else if (change.kind === "status")
      shown = { ...shown, status: Boolean(to), planned: false };
    else if (change.kind === "planned")
      shown = to
        ? { ...shown, planned: true, status: false }
        : { ...shown, planned: false, bookmark: 1 };
    else if (change.kind === "rating")
      shown = { ...shown, rating: (to as number) || null };
    else shown = { ...shown, description: (to as string | null) || null };
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

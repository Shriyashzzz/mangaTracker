// How a change made offline is put together with what the server has now,
// which another device may have changed in the meantime. Pure, so it can be
// tested on its own (offlineChanges.ts applies it).
//
//   owned volumes      sent as where they started and where they ended up,
//                      so what was added and taken away can be told apart:
//                      only those are applied. A volume ticked on the laptop
//                      meanwhile stays; one taken off there stays off
//   chapter, volume    sent with the number it was moved from. Nobody else
//   read               moved it since: theirs is saved, back or forward.
//                      Somebody did: the furthest of the two wins, as when
//                      two shelf entries are merged (mangaQueries merge)
//   finished and       one change, both together, since each moves the
//   To read (state),   other (finishing takes a series off To read). Sent
//   rating             with what it was before. Nobody else changed it
//                      since: theirs is saved. Somebody did: the other
//                      device's newer choice stays
//   notes              the same, except both edited: neither is lost. The
//                      other device's note stays, with this one under it
//                      marked "(written offline)"
//
// readChange checks a change as sent, and is the only way one gets in.

const MOST_NOTES = 450;
const MOST_CHAPTER = 100000;
const MOST_VOLUME = 999;

export type ValueKind = "state" | "rating" | "notes";
// a series' place on the shelf: finished or not, on To read or not
export type ShelfState = { status: boolean; planned: boolean };
export type Change =
  | { kind: "owned"; mangaId: number; started: number[]; ended: number[] }
  | { kind: "bookmark"; mangaId: number; from: number | null; to: number }
  | {
      kind: "readVolume";
      mangaId: number;
      from: number | null;
      to: number | null;
    }
  | { kind: "state"; mangaId: number; from: ShelfState; to: ShelfState }
  | { kind: "rating"; mangaId: number; from: number; to: number }
  | {
      kind: "notes";
      mangaId: number;
      from: string | null;
      to: string | null;
    };

const isWhole = (v: unknown, most: number): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= most;
const wholeOrNull = (v: unknown, most: number) =>
  v === null || v === undefined ? null : isWhole(v, most) ? v : undefined;
const volumes = (v: unknown) =>
  Array.isArray(v) &&
  v.length <= MOST_VOLUME &&
  v.every((n) => typeof n === "number" && n >= 0 && n <= MOST_VOLUME)
    ? (v as number[])
    : undefined;
// a note as it's saved: trimmed, empty as none
const noteOf = (v: unknown) => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const note = v.trim();
  if (note.length > MOST_NOTES) return undefined;
  return note || null;
};

const stateOf = (v: unknown): ShelfState | null => {
  const s = v as Partial<ShelfState> | null;
  return s && typeof s.status === "boolean" && typeof s.planned === "boolean"
    ? { status: s.status, planned: s.planned }
    : null;
};

// a change as sent, checked; null when it isn't one
export function readChange(raw: unknown): Change | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const mangaId = c.mangaId;
  if (!Number.isInteger(mangaId) || (mangaId as number) < 1) return null;
  const id = mangaId as number;
  switch (c.kind) {
    case "owned": {
      const started = volumes(c.started ?? []);
      const ended = volumes(c.ended ?? []);
      return started && ended
        ? { kind: "owned", mangaId: id, started, ended }
        : null;
    }
    case "bookmark": {
      const from = wholeOrNull(c.from, MOST_CHAPTER);
      return from !== undefined && isWhole(c.to, MOST_CHAPTER)
        ? { kind: "bookmark", mangaId: id, from, to: c.to }
        : null;
    }
    case "readVolume": {
      const from = wholeOrNull(c.from, MOST_CHAPTER);
      const to = wholeOrNull(c.to, MOST_CHAPTER);
      return from !== undefined && to !== undefined
        ? { kind: "readVolume", mangaId: id, from, to }
        : null;
    }
    case "state": {
      const from = stateOf(c.from);
      const to = stateOf(c.to);
      return from && to ? { kind: "state", mangaId: id, from, to } : null;
    }
    case "rating": {
      // no rating is 0 stars, as the stars show it
      const from = wholeOrNull(c.from, 5);
      const to = wholeOrNull(c.to, 5);
      return from !== undefined && to !== undefined
        ? { kind: "rating", mangaId: id, from: from ?? 0, to: to ?? 0 }
        : null;
    }
    case "notes": {
      const from = noteOf(c.from);
      const to = noteOf(c.to);
      return from !== undefined && to !== undefined
        ? { kind: "notes", mangaId: id, from, to }
        : null;
    }
    default:
      return null;
  }
}

const sortedOnce = (volumes: number[]) =>
  [...new Set(volumes)].sort((a, b) => a - b);

export function mergeOwned(
  now: number[],
  started: number[],
  ended: number[],
): number[] {
  const added = ended.filter((v) => !started.includes(v));
  const taken = new Set(started.filter((v) => !ended.includes(v)));
  return sortedOnce([...now.filter((v) => !taken.has(v)), ...added]);
}

export function mergePlace(
  now: number | null,
  from: number | null,
  to: number | null,
): number | null {
  if ((now ?? null) === (from ?? null)) return to;
  return Math.max(now ?? 0, to ?? 0);
}

// finished, To read, rating: theirs, unless another device changed it since
export function mergeValue<T>(now: T, from: T, to: T): T {
  return now === from ? to : now;
}

// notes: theirs, unless another device changed them since. Then the other
// device's stay, with theirs under them, unless theirs adds nothing
export function mergeNotes(
  now: string | null,
  from: string | null,
  to: string | null,
): string | null {
  if (now === from || !now) return to;
  if (!to || to === from || now.includes(to)) return now;
  return `${now}\n\n${to} (written offline)`;
}

// finished and To read, together: theirs, unless another device changed
// either since
export const sameState = (a: ShelfState, b: ShelfState) =>
  a.status === b.status && a.planned === b.planned;
export const mergeState = (
  now: ShelfState,
  from: ShelfState,
  to: ShelfState,
): ShelfState => (sameState(now, from) ? to : now);

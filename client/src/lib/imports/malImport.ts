// Reading a MyAnimeList export where it was picked, so the file itself never
// leaves their device (malFile.ts opens it in the browser). It arrives as
// .xml.gz from the export page, as .xml if they've opened it, and as .zip if
// they've zipped it up. Then sending a list, from any import, to the shelf.
import type { NewBook } from "../books";
import { apiFetch } from "../api";

export type MalEntry = {
  malId?: number;
  title: string;
  finished: boolean;
  chapters: number;
  readVolumes: number;
  ownedVolumes: number;
  score: number;
  comments?: string;
  // from a plan to read or to-read list: goes on their To read list
  planned?: boolean;
  // AniList's cover, for a series matched by name: used when there's no
  // MyAnimeList id to look one up by
  cover?: string;
  // the import already knows it's a light novel. Without it the server asks
  // AniList, by the MyAnimeList id
  lightNovel?: boolean;
  // exactly which volumes they own, when a book app's file says and it isn't
  // a run from 1 (One Piece 1 and 4)
  ownedList?: number[];
  // a book app's file: ownedVolumes is its own answer (server malEntry.ts)
  ownedFromFile?: boolean;
  // other names the series goes by (the file's own, AniList's): one on the
  // shelf under any of them is the same series
  otherNames?: string[];
  // from Manga Tracker's own export: a series already on the shelf takes
  // what it lacks too (chapter, finished, rating, notes)
  restore?: boolean;
  // from a backup: the edition they collect it in ("deluxe")
  edition?: string;
  // when they last changed it where it came from (imports/importDate.ts), so
  // the shelf's "Last updated" order comes along. ISO text
  updatedAt?: string;
  // the books behind the owned volumes, with ISBNs and editions
  books?: NewBook[];
  // from a backup: the series keeps its place by the volume
  byVolume?: boolean;
  // a backup's own genre (they may have set it by hand)
  genre?: string;
  // a book list that says nothing about reading (server malEntry.ts)
  readingUnknown?: boolean;
};

// the lists on MyAnimeList, in the order it shows them
export const MAL_LISTS = [
  { status: "Reading", label: "Reading", importByDefault: true },
  { status: "Completed", label: "Completed", importByDefault: true },
  { status: "On-Hold", label: "On hold", importByDefault: true },
  { status: "Dropped", label: "Dropped", importByDefault: false },
  { status: "Plan to Read", label: "Plan to read", importByDefault: false },
] as const;

export type MalItem = { status: string; entry: MalEntry };

// series sent to the shelf at a time: small enough that the progress bar
// moves on an import of 30, big enough that 400 is 20 requests (each one
// asks AniList once, and AniList limits how often)
const PIECE = 20;

// the export's reader, kept apart so it can be tested without the API client
export {
  ImportFileError,
  MAL_FILE_TOO_BIG,
  MAX_MAL_FILE_BYTES,
  malItemsFromXml,
  unpackMalExport,
} from "./malXml";

export type ImportTotals = {
  added: number;
  alreadyThere: number;
  // of those already there, how many got volumes they didn't have (the
  // server adds them, never takes any away); missing from an older server
  volumesAdded?: number;
  noCover: number;
  // new series that are complete sets: every volume of an ended series, and
  // nothing in the file about reading. The last page asks whether to mark
  // them finished (server malEntry.ts ownsWholeSeries)
  completeSets?: number[];
};

// how long to wait when the server says "slow down", and how often: its
// allowance is by the minute (server rateLimit), so a minute clears it
const SLOW_DOWN_WAITS = 3;
const waitFor = (ms: number) => new Promise((done) => setTimeout(done, ms));

// One piece. Tried again once after a pause if the connection dropped or
// the server was busy; and when the server asks to slow down (a list of
// thousands sends its pieces faster than it allows), it waits as long as
// asked and carries on, telling the page it's waiting. Trying again is
// safe: anything already added is skipped
async function sendPiece(
  entries: MalEntry[],
  onWaiting: (waiting: boolean) => void,
): Promise<Response> {
  const send = () =>
    apiFetch("/api/manga/import", { method: "POST", body: { entries } }).catch(
      () => null,
    );
  let res = await send();
  for (let waits = 0; res?.status === 429 && waits < SLOW_DOWN_WAITS; waits++) {
    const asked = Number(res.headers.get("Retry-After")) || 60;
    onWaiting(true);
    await waitFor((Math.min(asked, 60) + 1) * 1000);
    onWaiting(false);
    res = await send();
  }
  if (res && res.status < 500) return res;
  // dropped, or the server was busy: once more
  await waitFor(5000);
  res = await send();
  if (res) return res;
  throw new Error("The connection dropped");
}

// a piece at a time, so a long list shows progress. Stops at the first failure
// with the totals so far and what went wrong; trying again skips what's
// already been added
export async function sendToShelf(
  entries: MalEntry[],
  onProgress: (done: number, totals: ImportTotals) => void,
  // asked to stop: the piece being sent finishes, the rest aren't sent
  shouldStop: () => boolean = () => false,
  // true while it waits because the server asked it to slow down
  onWaiting: (waiting: boolean) => void = () => {},
) {
  const totals: ImportTotals = {
    added: 0,
    alreadyThere: 0,
    volumesAdded: 0,
    noCover: 0,
    completeSets: [],
  };
  for (let i = 0; i < entries.length && !shouldStop(); i += PIECE) {
    const piece = entries.slice(i, i + PIECE);
    const res = await sendPiece(piece, onWaiting).catch((e: Error) => {
      throw Object.assign(e, { totals });
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: { msg?: string }[];
      } | null;
      throw Object.assign(new Error(data?.error?.[0]?.msg ?? "Import failed"), {
        totals,
      });
    }
    const answer = (await res.json()) as ImportTotals;
    totals.added += answer.added;
    totals.alreadyThere += answer.alreadyThere;
    totals.volumesAdded =
      (totals.volumesAdded ?? 0) + (answer.volumesAdded ?? 0);
    totals.noCover += answer.noCover;
    totals.completeSets = [
      ...(totals.completeSets ?? []),
      ...(answer.completeSets ?? []),
    ];
    onProgress(i + piece.length, { ...totals });
  }
  return totals;
}

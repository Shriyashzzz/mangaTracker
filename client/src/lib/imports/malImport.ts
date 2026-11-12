// Reading a MyAnimeList export in the browser, so the file itself never leaves
// their computer. It arrives as .xml.gz from the export page, as .xml if they've
// opened it, and as .zip if they've zipped it up.
import { gunzipSync, strFromU8, unzipSync } from "fflate";
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
  // other names the series goes by (the file's own, AniList's): one on the
  // shelf under any of them is the same series
  otherNames?: string[];
  // from Manga Tracker's own export: a series already on the shelf takes
  // what it lacks too (chapter, finished, rating, notes)
  restore?: boolean;
  // a backup's own genre (they may have set it by hand)
  genre?: string;
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

// errors that are worth showing as they are
export class ImportFileError extends Error {}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const PIECE = 50;

const toXml = async (file: File) => {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError(
      "That file is too big to be a MyAnimeList export. Check you picked the right one.",
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    if (bytes[0] === 0x1f && bytes[1] === 0x8b)
      return strFromU8(gunzipSync(bytes));
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const files = unzipSync(bytes);
      const name = Object.keys(files).find((n) => /\.xml(\.gz)?$/i.test(n));
      const inside = name ? files[name] : undefined;
      if (!name || !inside)
        throw new ImportFileError("There's no list inside that zip.");
      return strFromU8(/\.gz$/i.test(name) ? gunzipSync(inside) : inside);
    }
  } catch (e) {
    if (e instanceof ImportFileError) throw e;
    throw new ImportFileError(
      "That file couldn't be opened. Try downloading it again.",
    );
  }
  return strFromU8(bytes);
};

const text = (el: Element, tag: string) =>
  el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
const whole = (el: Element, tag: string) => {
  const value = Number.parseInt(text(el, tag), 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export async function readMalExport(file: File): Promise<MalItem[]> {
  const doc = new DOMParser().parseFromString(
    await toXml(file),
    "application/xml",
  );
  const isMal =
    !doc.getElementsByTagName("parsererror").length &&
    doc.documentElement.nodeName === "myanimelist";
  if (!isMal) {
    throw new ImportFileError(
      "That isn't a MyAnimeList export. Pick the file you downloaded from the export page.",
    );
  }
  if (doc.getElementsByTagName("anime").length) {
    throw new ImportFileError(
      "That's your anime list. On the export page, choose Manga and try again.",
    );
  }

  const items: MalItem[] = [];
  for (const el of Array.from(doc.getElementsByTagName("manga"))) {
    const title = text(el, "manga_title");
    if (!title) continue;
    const status = text(el, "my_status");
    const malId = whole(el, "manga_mangadb_id");
    const comments = text(el, "my_comments");
    items.push({
      status,
      entry: {
        ...(malId ? { malId } : {}),
        title,
        finished: status === "Completed",
        ...(status === "Plan to Read" ? { planned: true } : {}),
        chapters: Math.min(whole(el, "my_read_chapters"), 100000),
        readVolumes: Math.min(whole(el, "my_read_volumes"), 999),
        ownedVolumes: Math.min(whole(el, "my_retail_volumes"), 999),
        score: Math.min(whole(el, "my_score"), 10),
        // the shelf keeps 450 characters, so a long list of notes stays small
        ...(comments ? { comments: comments.slice(0, 450) } : {}),
      },
    });
  }
  return items;
}

export type ImportTotals = {
  added: number;
  alreadyThere: number;
  // of those already there, how many got volumes they didn't have (the
  // server adds them, never takes any away); missing from an older server
  volumesAdded?: number;
  noCover: number;
};

// one piece, tried again once after a pause if the connection dropped or the
// server was busy. Trying again is safe: anything already added is skipped
async function sendPiece(entries: MalEntry[]): Promise<Response> {
  for (const pause of [0, 5000]) {
    if (pause) await new Promise((done) => setTimeout(done, pause));
    const res = await apiFetch("/api/manga/import", {
      method: "POST",
      body: { entries },
    }).catch(() => null);
    if (res && (res.ok || (res.status < 500 && res.status !== 429))) return res;
    if (pause && res) return res;
  }
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
) {
  const totals: ImportTotals = {
    added: 0,
    alreadyThere: 0,
    volumesAdded: 0,
    noCover: 0,
  };
  for (let i = 0; i < entries.length && !shouldStop(); i += PIECE) {
    const piece = entries.slice(i, i + PIECE);
    const res = await sendPiece(piece).catch((e: Error) => {
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
    onProgress(i + piece.length, { ...totals });
  }
  return totals;
}

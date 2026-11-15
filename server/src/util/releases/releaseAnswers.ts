// Each manga's last release check, saved as it was answered (release_answers),
// so the New tab can open a whole shelf with one request instead of one per
// series. An answer is handed back only while it's fresh and while everything
// it depended on is as it was: the key changes the moment the series is
// renamed, they read on, hide something, or change their release settings
import { prisma } from "../../config/prisma.js";
import type { Manga } from "../../../generated/prisma/client.js";
import { readReleaseSettings } from "./releaseStatus.js";

// as long as the sources it came from are kept (releaseCache.ts)
export const ANSWER_FRESH_MS = 6 * 60 * 60 * 1000;

type Prefs = {
  releaseChecks?: unknown;
  releases?: unknown;
  trackBy?: unknown;
} | null;
type Keyed = Pick<
  Manga,
  | "name"
  | "lightNovel"
  | "volumesOwned"
  | "bookmark"
  | "byVolume"
  | "readVolume"
  | "seenVolume"
  | "seenChapter"
  | "seenJapanVolume"
  | "hiddenVolumes"
  | "planned"
> & { ownedList?: number[] | null };

// What the New tab lists for them, as an answer was worked out with: their
// own choice, or the defaults for a reader who hasn't made one. The
// defaults count: when they change, every answer saved under the old ones
// is out of date
const listedAs = (prefs: Prefs) => readReleaseSettings(prefs?.releases);

// their release settings alone, for the browser to tell when they've changed
export const settingsPrint = (prefs: Prefs) =>
  JSON.stringify([
    prefs?.releaseChecks ?? null,
    listedAs(prefs),
    ...(prefs?.trackBy ? [prefs.trackBy] : []),
  ]);

// Bumped when the rules that work out an answer change, so answers saved
// under the old ones aren't handed back after a deploy (they'd last up to
// six hours). v2: a chapter reader with no books counts from the volume
// their next chapter is in; a finished series shows the next chapter to a
// reader behind
const ANSWER_RULES = "v2";

const answerKey = (m: Keyed, prefs: Prefs) =>
  JSON.stringify([
    ANSWER_RULES,
    m.name,
    m.lightNovel,
    m.volumesOwned,
    m.ownedList ?? null,
    m.bookmark,
    m.byVolume,
    m.readVolume,
    m.seenVolume,
    m.seenChapter,
    m.seenJapanVolume,
    m.hiddenVolumes,
    m.planned,
    prefs?.releaseChecks ?? null,
    listedAs(prefs),
    prefs?.trackBy ?? null,
  ]);

type SavedAnswer = {
  releaseStatus: unknown;
  complete: boolean;
  outcome: string;
};

// a database problem only costs the shortcut, never the answer
export async function saveAnswer(
  m: Keyed & { id: number },
  prefs: Prefs,
  answer: SavedAnswer,
) {
  // worth keeping only when it's whole: a failed or partial answer is worth
  // asking again, and "off" isn't an answer
  if (
    !answer.complete ||
    answer.outcome === "failed" ||
    answer.outcome === "off"
  )
    return;
  const row = {
    key: answerKey(m, prefs),
    // what the shelf uses; the full dates are kept elsewhere (release_dates)
    answer: {
      releaseStatus: answer.releaseStatus,
      complete: answer.complete,
      outcome: answer.outcome,
    } as object,
    checkedAt: new Date(),
  };
  await prisma.releaseAnswer
    .upsert({
      where: { mangaId: m.id },
      create: { mangaId: m.id, ...row },
      update: row,
    })
    .catch((e: unknown) =>
      console.error("release answer save failed:", (e as Error).message),
    );
}

// the shelf's saved answers still good to use, by manga id, with when each
// was checked
export async function savedAnswers(
  shelf: (Keyed & { id: number })[],
  prefs: Prefs,
  now = Date.now(),
) {
  const rows = await prisma.releaseAnswer.findMany({
    where: {
      mangaId: { in: shelf.map((m) => m.id) },
      checkedAt: { gte: new Date(now - ANSWER_FRESH_MS) },
    },
  });
  const byId = new Map(shelf.map((m) => [m.id, m]));
  const out: Record<number, SavedAnswer & { checkedAt: string }> = {};
  for (const row of rows) {
    const m = byId.get(row.mangaId);
    if (!m || row.key !== answerKey(m, prefs)) continue;
    out[row.mangaId] = {
      ...(row.answer as unknown as SavedAnswer),
      checkedAt: row.checkedAt.toISOString(),
    };
  }
  return out;
}

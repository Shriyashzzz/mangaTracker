// Keeps getReleaseDates polite: one call makes about 8 MangaDex requests and
// MangaDex allows 5 a second, so a whole shelf goes one title at a time with a
// pause between each, in two lanes: what someone's likely waiting on first,
// the rest of a big shelf when nothing else is (laneQueue.ts). Answers are kept 6 hours in the database, so a restart
// doesn't mean asking again. Failures, and answers found without AniList's id
// to confirm the series, are only remembered briefly in memory: a wrong match
// shouldn't be shared with everyone for hours. A stuck lookup is given up on, so
// it can never hold up the titles queued behind it.
import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { slugify } from "../../prices/stores/match.js";
import getReleaseDates from "../../../scripts/getReleaseDates.js";
import type {
  MangaReleaseDates,
  SeriesMatch,
} from "../../../scripts/getReleaseDates.js";
import {
  getChapterSource,
  type ChapterSource,
} from "../../prices/sources/mangaUpdates.js";
import type { FormatedDates } from "./volumeDataFormatter.js";
import { laneQueue, type Lane } from "./laneQueue.js";

type Answer = MangaReleaseDates<FormatedDates>;

const FRESH_MS = 6 * 60 * 60 * 1000;
const BRIEF_MS = 10 * 60 * 1000;
const PAUSE_MS = 1000; // between titles
const LOOKUP_TIMEOUT_MS = 20_000; // the lookup itself
const WAIT_TIMEOUT_MS = 15_000; // how long a page waits for it

// a big shelf's "later" checks waiting at once, across everyone
const MAX_LATER = 1000;

const brief = new Map<string, { answer: Answer; at: number }>();
const running = new Map<string, Promise<Answer>>();
const checks = laneQueue<Answer>({
  pauseMs: PAUSE_MS,
  maxLater: MAX_LATER,
  onFailure: { ok: false },
});

// the promise's answer, or `fallback` if it takes longer than `ms`
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// a second opinion on the chapters. Whichever source is furthest along wins, as
// each can only be behind. Its number has no date, and any guess at the next
// chapter from the lower count no longer means anything
export function withChapterSource(
  dates: FormatedDates | null,
  source: ChapterSource | null,
): FormatedDates | null {
  if (!source) return dates;
  const merged: FormatedDates = {
    ...dates,
    ...(source.finished ? { seriesFinished: true } : {}),
  };
  const current = parseFloat(
    dates?.chapter?.latestReleased.chapterNumber ?? "",
  );
  const isAhead =
    source.latestChapter != null &&
    (!Number.isFinite(current) || source.latestChapter > current);
  if (isAhead) {
    merged.chapter = {
      latestReleased: {
        chapterNumber: String(source.latestChapter),
        releaseDate: null,
      },
      estimateRelease: {
        chapterNumber: null,
        releaseDate: null,
        isEstimate: false,
        confidence: "low",
      },
    };
  }
  return dates || source.latestChapter != null ? merged : null;
}

// a database problem just means asking MangaDex again
const readStored = async (key: string): Promise<Answer | null> => {
  try {
    const row = await prisma.releaseDates.findUnique({ where: { slug: key } });
    if (!row || Date.now() - row.fetchedAt.getTime() >= FRESH_MS) return null;
    return { ok: true, data: row.data as FormatedDates };
  } catch (e) {
    console.error("release dates read failed:", (e as Error).message);
    return null;
  }
};

const store = async (key: string, data: FormatedDates) => {
  const fields = {
    data: data as unknown as Prisma.InputJsonValue,
    fetchedAt: new Date(),
  };
  await prisma.releaseDates
    .upsert({
      where: { slug: key },
      create: { slug: key, ...fields },
      update: fields,
    })
    .catch((e) =>
      console.error("release dates save failed:", (e as Error).message),
    );
};

export async function getCachedReleaseDates(
  name: string,
  match: SeriesMatch = {},
  lane: Lane = "now",
): Promise<Answer> {
  const key = (slugify(name) || name.trim().toLowerCase()).slice(0, 160);

  const stored = await readStored(key);
  if (stored) return stored;
  const remembered = brief.get(key);
  if (remembered && Date.now() - remembered.at < BRIEF_MS) {
    return remembered.answer;
  }

  let lookup = running.get(key);
  // already waiting in "later", and now someone's waiting on it
  if (lookup && lane === "now") checks.promote(key);
  if (!lookup) {
    const queued = checks.add(key, lane, async () => {
      const [answer, source] = await Promise.all([
        withTimeout(getReleaseDates(name, match), LOOKUP_TIMEOUT_MS, {
          ok: false,
        } as Answer),
        getChapterSource([name, ...(match.altNames ?? [])]),
      ]);
      const data = withChapterSource(
        answer.ok ? (answer.data ?? null) : null,
        source,
      );
      return data ? { ok: true as const, data } : answer;
    });
    // "later" is full: the shelf asks again on its next visit
    if (!queued) return { ok: false };
    lookup = queued;
    running.set(key, lookup);
    lookup
      .then(async (answer) => {
        if (answer.ok && answer.data && match.anilistId) {
          brief.delete(key);
          await store(key, answer.data);
        } else {
          brief.set(key, { answer, at: Date.now() });
          if (brief.size > 500) brief.delete(brief.keys().next().value!);
        }
      })
      .finally(() => running.delete(key));
  }

  // the wait is shorter than the lookup: the page moves on, and a late answer
  // is still saved for the next check
  return withTimeout(lookup, WAIT_TIMEOUT_MS, { ok: false });
}

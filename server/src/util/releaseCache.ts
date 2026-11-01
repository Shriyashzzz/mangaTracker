// Keeps getReleaseDates polite: one call makes about 8 MangaDex requests and
// MangaDex allows 5 a second, so a whole shelf goes one title at a time with a
// pause between each. Answers are kept 6 hours in the database, so a restart
// doesn't mean asking again. Failures, and answers found without AniList's id
// to confirm the series, are only remembered briefly in memory: a wrong match
// shouldn't be shared with everyone for hours. A stuck lookup is given up on, so
// it can never hold up the titles queued behind it.
import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { slugify } from "../prices/match.js";
import getReleaseDates from "../../scripts/getReleaseDates.js";
import type {
  MangaReleaseDates,
  SeriesMatch,
} from "../../scripts/getReleaseDates.js";
import type { FormatedDates } from "./volumeDataFormatter.js";

type Answer = MangaReleaseDates<FormatedDates>;

const FRESH_MS = 6 * 60 * 60 * 1000;
const BRIEF_MS = 10 * 60 * 1000;
const PAUSE_MS = 1000; // between titles
const LOOKUP_TIMEOUT_MS = 20_000; // the lookup itself
const WAIT_TIMEOUT_MS = 15_000; // how long a page waits for it

const brief = new Map<string, { answer: Answer; at: number }>();
const running = new Map<string, Promise<Answer>>();
let queue: Promise<unknown> = Promise.resolve();

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
): Promise<Answer> {
  const key = (slugify(name) || name.trim().toLowerCase()).slice(0, 160);

  const stored = await readStored(key);
  if (stored) return stored;
  const remembered = brief.get(key);
  if (remembered && Date.now() - remembered.at < BRIEF_MS) {
    return remembered.answer;
  }

  let lookup = running.get(key);
  if (!lookup) {
    lookup = queue.then(() =>
      withTimeout(getReleaseDates(name, match), LOOKUP_TIMEOUT_MS, {
        ok: false,
      }),
    );
    queue = lookup.then(
      () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS)),
    );
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

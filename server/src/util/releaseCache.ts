// Keeps getReleaseDates polite: one call makes about 7 MangaDex requests and
// MangaDex allows 5 a second, so a whole shelf has to go one title at a time.
// Answers are kept in memory for 6 hours; failures aren't kept, so they retry.
import getReleaseDates from "../../scripts/getReleaseDates.js";
import type {
  MangaReleaseDates,
  SeriesMatch,
} from "../../scripts/getReleaseDates.js";
import type { FormatedDates } from "./volumeDataFormatter.js";

type Answer = MangaReleaseDates<FormatedDates>;

const FRESH_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 15_000;

const cache = new Map<string, { answer: Answer; at: number }>();
const running = new Map<string, Promise<Answer>>();
let queue: Promise<unknown> = Promise.resolve();

export async function getCachedReleaseDates(
  name: string,
  match: SeriesMatch = {},
): Promise<Answer> {
  const key = name.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.answer;

  let lookup = running.get(key);
  if (!lookup) {
    lookup = queue.then(() => getReleaseDates(name, match));
    queue = lookup;
    running.set(key, lookup);
    lookup
      .then((answer) => {
        if (answer.ok) cache.set(key, { answer, at: Date.now() });
      })
      .finally(() => running.delete(key));
  }

  // a slow MangaDex shouldn't hold the page up; the lookup still finishes and
  // is ready for the next visit
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<Answer>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false }), TIMEOUT_MS);
  });
  return Promise.race([lookup, timeout]).finally(() => clearTimeout(timer));
}

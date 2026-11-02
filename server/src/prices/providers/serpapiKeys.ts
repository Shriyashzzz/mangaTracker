// More than one SerpApi key: each gets its own monthly allowance, and when one runs
// out the next takes over. Keys never leave this server: logs and the api_usage
// table only ever see a label made from a hash of the key.
import { createHash } from "node:crypto";

// SERPAPI_API_KEY, a comma-separated SERPAPI_API_KEYS, or numbered ones such as
// SERPAPI_API_KEY_2 or SERPAPI_KEY2. In that order, with repeats dropped
const EXTRA_KEY_NAME = /^SERPAPI_(API_)?KEY(S|_?\d+)$/;

const toKeys = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

export function serpApiKeys(env: Record<string, string | undefined>) {
  const extras = Object.keys(env)
    .filter((name) => EXTRA_KEY_NAME.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .flatMap((name) => toKeys(env[name]));
  return [...new Set([...toKeys(env.SERPAPI_API_KEY), ...extras])];
}

// the main key keeps the label it's always had, so its count carries on
export const usageLabel = (key: string, mainKey: string | undefined) =>
  key === mainKey?.trim()
    ? "serpapi"
    : `serpapi-${createHash("sha256").update(key).digest("hex").slice(0, 12)}`;

// no key has a search left. Not the same as finding nothing: the stored prices
// stay up rather than being replaced by an empty check
export class SearchesUsedUp extends Error {}

// what SerpApi's answer means for this key
export type KeyAnswer =
  | "ok"
  // nothing left on it until the month turns over
  | "out-of-searches"
  // not usable for now, though it may be later: rate limited, or a bad key
  | "skip"
  | "error";

export function readAnswer(status: number, error?: string): KeyAnswer {
  if (/run out of searches/i.test(error ?? "")) return "out-of-searches";
  // nothing found is an answer, not a failure
  if (/hasn.t returned any results/i.test(error ?? "")) return "ok";
  if (status === 401 || status === 403 || status === 429) return "skip";
  return status >= 200 && status < 300 && !error ? "ok" : "error";
}

type Rotation<T> = {
  keys: string[];
  // takes one search from this key's allowance; false if it has none left
  claim: (key: string) => Promise<boolean>;
  // SerpApi says it's out, whatever our own count thinks
  markSpent: (key: string) => Promise<void>;
  search: (key: string) => Promise<{ answer: KeyAnswer; data: T; error?: string }>;
};

// the answer from the first key that can give one, or null if none could. Any other
// failure is the search's own problem, and another key wouldn't change it
export async function searchWithKeys<T>({
  keys,
  claim,
  markSpent,
  search,
}: Rotation<T>): Promise<T | null> {
  for (const key of keys) {
    if (!(await claim(key))) continue;
    const { answer, data, error } = await search(key);
    if (answer === "ok") return data;
    if (answer === "error") throw new Error(`SerpApi: ${error ?? "unknown error"}`);
    if (answer === "out-of-searches") await markSpent(key);
  }
  return null;
}

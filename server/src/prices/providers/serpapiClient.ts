// One SerpApi search, on whichever key still has searches left. Every SerpApi
// source goes through here, so they all share the keys and the monthly counts.
import config from "../../config/config.js";
import priceQueries from "../../models/priceQueries.js";
import {
  readAnswer,
  searchWithKeys,
  serpApiKeys,
  usageLabel,
} from "./serpapiKeys.js";

const SEARCH_URL = "https://serpapi.com/search.json";

// config has already loaded server/.env by now
const KEYS = serpApiKeys(process.env);
if (KEYS.length > 1) console.log(`SerpApi: ${KEYS.length} keys ready`);
const labelOf = (key: string) => usageLabel(key, config.SERPAPI_API_KEY);

export const serpApiEnabled = () => KEYS.length > 0;

// the response, or null when every key is used up
export async function searchSerpApi<T extends { error?: string }>(
  params: Record<string, string>,
  signal: AbortSignal,
): Promise<T | null> {
  const data = await searchWithKeys<T>({
    keys: KEYS,
    // claim a search from this month's budget before spending it
    claim: (key) =>
      priceQueries.claimApiCall(labelOf(key), config.SERPAPI_MONTHLY_LIMIT),
    markSpent: async (key) => {
      console.warn(`SerpApi key ${labelOf(key)} is out of searches this month`);
      await priceQueries.markApiSpent(labelOf(key), config.SERPAPI_MONTHLY_LIMIT);
    },
    search: async (key) => {
      const query = new URLSearchParams({ ...params, api_key: key });
      const res = await fetch(`${SEARCH_URL}?${query}`, { signal });
      const answer = (await res.json().catch(() => ({}))) as T;
      const error =
        answer.error ?? (res.ok ? undefined : `responded ${res.status}`);
      return { answer: readAnswer(res.status, error), data: answer, error };
    },
  });
  if (!data) {
    console.warn("Every SerpApi key is used up for now, skipping this search");
  }
  return data;
}

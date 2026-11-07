// AniList's matches for a title, looked up a moment after they stop typing.
// Shared by the add page's title dropdown and the edit form's cover strip.
// onFound hears each finished lookup (the edit form uses it to choose a
// cover for them); it's read when the lookup ends, so it needn't be stable.
import { useEffect, useRef, useState } from "react";
import { searchCovers, type CoverHit } from "../../lib/anilist";

export type SearchStatus = "idle" | "loading" | "done" | "error";

export const MIN_QUERY = 3;
const DEBOUNCE_MS = 450;

export function useCoverSearch(
  title: string,
  {
    perPage = 6,
    onFound,
  }: {
    perPage?: number;
    onFound?: (found: CoverHit[], query: string) => void;
  } = {},
) {
  const [results, setResults] = useState<{
    query: string;
    hits: CoverHit[];
  }>({ query: "", hits: [] });
  // the title AniList couldn't be reached for
  const [failed, setFailed] = useState<string | null>(null);
  const found = useRef(onFound);
  useEffect(() => {
    found.current = onFound;
  });

  const query = title.trim();
  const tooShort = query.length < MIN_QUERY;

  useEffect(() => {
    if (tooShort) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const hits = await searchCovers(query, controller.signal, perPage);
        setResults({ query, hits });
        setFailed(null);
        found.current?.(hits, query);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(query);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, tooShort, perPage]);

  // worked out from which title the answer is for: until the box's own
  // title is answered, it's still looking
  const status: SearchStatus = tooShort
    ? "idle"
    : results.query === query
      ? "done"
      : failed === query
        ? "error"
        : "loading";
  return {
    status,
    // the last answer's hits, which may be for an older title (the cover
    // strip dims them while it looks); a cleared title has none
    hits: tooShort ? [] : results.hits,
    query: results.query,
  };
}

// AniList's matches for a title, looked up a moment after they stop typing.
// Shared by the add page's title dropdown and the edit form's cover strip.
// onFound hears each finished lookup (the edit form uses it to choose a
// cover for them); it's read when the lookup ends, so it needn't be stable.
import { useEffect, useRef, useState } from "react";
import { searchCovers, type CoverHit } from "../../lib/anilist";

export type SearchStatus = "idle" | "loading" | "done" | "error";

export const MIN_QUERY = 3;
const DEBOUNCE_MS = 450;

// a title that found nothing, tried again by its longer words, longest
// first: "vinland sga" finds Vinland Saga by "vinland". Two tries at most
export const wordsToTry = (query: string) =>
  [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u))]
    .filter((word) => word.length >= 4 && word !== query.toLowerCase())
    .sort((a, b) => b.length - a.length)
    .slice(0, 2);

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
    // found by one of its words, not the whole title: "Did you mean"
    guessed: boolean;
  }>({ query: "", hits: [], guessed: false });
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
        // a near miss (a typo): its words alone, never picked for them
        let near: CoverHit[] = [];
        for (const word of hits.length ? [] : wordsToTry(query)) {
          // only titles that hold the word: AniList's loose matches for
          // "nothing" aren't anything they meant
          near = (await searchCovers(word, controller.signal, perPage)).filter(
            (hit) => hit.title.toLowerCase().includes(word),
          );
          if (near.length) break;
        }
        setResults({
          query,
          hits: hits.length ? hits : near,
          guessed: !hits.length && near.length > 0,
        });
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
  // nothing to search yet, an answer for this very query, a failure for
  // it, or still waiting
  let status: SearchStatus = "loading";
  if (tooShort) status = "idle";
  else if (results.query === query) status = "done";
  else if (failed === query) status = "error";
  return {
    status,
    // the last answer's hits, which may be for an older title (the cover
    // strip dims them while it looks); a cleared title has none
    hits: tooShort ? [] : results.hits,
    guessed: !tooShort && results.guessed,
    query: results.query,
  };
}

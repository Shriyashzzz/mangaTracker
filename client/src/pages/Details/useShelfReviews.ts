// A series' reviews for its details page: which volume to ask about next,
// and what the reader has written. Loaded once the page is up, and again
// whenever `changes` does (what they own or have read) or after they write.
import { useCallback, useEffect, useState } from "react";
import { getShelfReviews, type ShelfReviews } from "../../lib/reviews";

const NONE: ShelfReviews = { toRate: [], written: [] };

// the two lists, really there: an answer that isn't them is no answer
const isShelfReviews = (data: ShelfReviews | null): data is ShelfReviews =>
  Array.isArray(data?.toRate) && Array.isArray(data?.written);

export function useShelfReviews(mangaId: number, changes: string) {
  // the answer with the series it's for, so another series' is never shown
  const [loaded, setLoaded] = useState<{
    mangaId: number;
    data: ShelfReviews;
  } | null>(null);

  // an extra: when it can't be loaded the page is whole without it
  const reload = useCallback(async () => {
    const data = await getShelfReviews(mangaId).catch(() => null);
    if (isShelfReviews(data)) setLoaded({ mangaId, data });
  }, [mangaId]);
  useEffect(() => {
    const controller = new AbortController();
    getShelfReviews(mangaId, controller.signal)
      .then((data) => {
        // only an answer of the right shape is kept
        if (isShelfReviews(data)) setLoaded({ mangaId, data });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [mangaId, changes]);

  const data = loaded?.mangaId === mangaId ? loaded.data : NONE;
  return { ...data, reload };
}

// Loads a volume's reviews for whoever is looking, and keeps them for the
// page: the section draws them, and the page's own tags carry the rating.
import { useCallback, useEffect, useState } from "react";
import { getVolumeReviews, type VolumeReviews } from "../../../lib/reviews";

export function useVolumeReviews(isbn13: string | null) {
  // the answer with the volume it's for, so another volume's is never shown
  const [loaded, setLoaded] = useState<{
    isbn13: string;
    data: VolumeReviews;
  } | null>(null);

  // reviews are an extra: when they can't be loaded the page is whole
  // without them, so a failure is left quiet
  const reload = useCallback(async () => {
    if (!isbn13) return;
    const data = await getVolumeReviews(isbn13).catch(() => null);
    if (data) setLoaded({ isbn13, data });
  }, [isbn13]);
  useEffect(() => {
    if (!isbn13) return;
    const controller = new AbortController();
    getVolumeReviews(isbn13, controller.signal)
      .then((data) => setLoaded({ isbn13, data }))
      .catch(() => {});
    return () => controller.abort();
  }, [isbn13]);

  const data = loaded?.isbn13 === isbn13 ? loaded.data : null;
  return { data, reload };
}

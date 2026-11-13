// A volume's prices, in two steps. The stored prices come first, straight
// away: they need no Turnstile, so the page (and what search engines see)
// never waits on it. Then a live check, only when the server says it would
// look again; until that answers, the stored prices stay on the page.
import { useEffect, useState } from "react";
import { getVolume } from "../../lib/prices";
import type { VolumePrices } from "../../lib/types";

export function useVolumeLoad(isbn: string, country: string) {
  // which ISBN the data is for, so an answer for another volume never shows
  const [state, setState] = useState<{
    isbn: string | null;
    data: VolumePrices | null;
    error: string;
  }>({ isbn: null, data: null, error: "" });
  // bumping this asks the server again ("Try again")
  const [attempt, setAttempt] = useState(0);
  // the volume being checked live right now, after its stored prices showed
  const [refreshing, setRefreshing] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getVolume(isbn, controller.signal, true)
      .then((data) => {
        setState({ isbn, data, error: "" });
        // Canadian prices are their own; these US ones are only for show
        if (country === "ca" || !data.refreshable) return;
        setRefreshing(isbn);
        return getVolume(isbn, controller.signal, false)
          .then((fresh) => setState({ isbn, data: fresh, error: "" }))
          .catch(() => {
            // a failed or refused live check leaves the stored prices
          })
          .finally(() => {
            if (!controller.signal.aborted) setRefreshing(null);
          });
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setState({ isbn, data: null, error: (e as Error).message });
        }
      });
    return () => {
      controller.abort();
      setRefreshing(null);
    };
  }, [isbn, attempt, country]);

  const answered = state.isbn === isbn;
  return {
    // still waiting for this volume's first answer
    loading: !answered,
    data: answered ? state.data : null,
    error: answered ? state.error : "",
    // a live check is running for this volume
    refreshing: refreshing === isbn,
    retry: () => {
      setState({ isbn: null, data: null, error: "" });
      setAttempt((n) => n + 1);
    },
  };
}

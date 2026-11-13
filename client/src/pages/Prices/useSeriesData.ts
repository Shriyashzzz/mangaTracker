// What a series' price page asks the server for, each as its own hook:
//   useSeriesLoad    the series and its volumes (with Try again)
//   useShelfMatch    the same series on their shelf, when signed in
//   useBoxSetScan    box sets a fresh look at the free sources found
import { useEffect, useState } from "react";
import { getJson } from "../../lib/api";
import { getSeries } from "../../lib/prices";
import { findOnShelf } from "../../lib/shelf";
import { humanQuery } from "../../lib/turnstile";
import type { BoxSet, Series, ShelfMatch } from "../../lib/types";
import { useAuth } from "../../store/auth";

// the series and its volumes. `key` names the request an answer belongs to:
// the series plus the attempt, so an answer for another series (or an
// earlier try) is never shown
export function useSeriesLoad(name: string) {
  const [state, setState] = useState<{
    key: string | null;
    data: Series | null;
    error: string;
  }>({ key: null, data: null, error: "" });
  // bumping this asks the server again ("Try again")
  const [attempt, setAttempt] = useState(0);
  const key = `${name}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    getSeries(name, controller.signal)
      .then((data) => setState({ key, data, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError") {
          setState({ key, data: null, error: e.message });
        }
      });
    return () => controller.abort();
    // key already includes name
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const answered = state.key === key;
  return {
    key,
    // still waiting for this series' answer
    loading: !answered,
    data: answered ? state.data : null,
    error: answered ? state.error : "",
    retry: () => setAttempt((a) => a + 1),
  };
}

// the series on their shelf, if it is: which volumes are theirs. Null when
// it isn't, they're signed out, or we couldn't tell (the page is then the
// same as for anyone else)
export function useShelfMatch(name: string): ShelfMatch {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [shelf, setShelf] = useState<{ name: string; manga: ShelfMatch }>({
    name: "",
    manga: null,
  });
  useEffect(() => {
    if (!isSignedIn) return;
    const controller = new AbortController();
    findOnShelf(name, controller.signal)
      .then((manga) => setShelf({ name, manga }))
      .catch(() => {});
    return () => controller.abort();
  }, [isSignedIn, name]);
  return shelf.name === name ? shelf.manga : null;
}

// box sets a fresh look at the free sources found (eBay, Books-A-Million):
// asked for once the page is up, and only looked for again when the saved
// answer is days old. Null until then, and when the look found nothing new
export function useBoxSetScan(
  name: string,
  // the request the page is showing (useSeriesLoad's key)
  key: string,
  loaded: boolean,
) {
  const [scanned, setScanned] = useState<{ key: string; sets: BoxSet[] }>({
    key: "",
    sets: [],
  });
  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    humanQuery("&", controller.signal)
      .then((human) =>
        getJson<{ boxSets: BoxSet[] | null }>(
          `/api/prices/series-sets?${new URLSearchParams({ name })}${human}`,
          controller.signal,
        ),
      )
      .then(({ boxSets }) => {
        if (boxSets) setScanned({ key, sets: boxSets });
      })
      .catch(() => {});
    return () => controller.abort();
    // key already includes name
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded]);
  return scanned.key === key ? scanned.sets : null;
}

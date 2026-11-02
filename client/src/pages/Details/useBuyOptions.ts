import { useEffect, useState } from "react";
import { getSeries } from "../../lib/prices";
import type { Series, SeriesVolume } from "../../lib/types";

// a volume we know the number of
export type NumberedVolume = SeriesVolume & { volume: number };

// what can be bought of this manga: the red bar and the Buy it box both need it,
// so it's asked for once here
export function useBuyOptions(name: string | null, volumesOwned: number | null) {
  // which name the data is for, so a stale answer never shows
  const [state, setState] = useState<{
    name: string | null;
    data: Series | null;
  }>({ name: null, data: null });

  useEffect(() => {
    if (!name) return;
    const controller = new AbortController();
    getSeries(name, controller.signal)
      .then((data) => setState({ name, data }))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setState({ name, data: null });
      });
    return () => controller.abort();
  }, [name]);

  const loading = state.name !== name;
  const volumes = loading
    ? []
    : (state.data?.volumes.filter(
        (v): v is NumberedVolume => v.volume != null,
      ) ?? []);
  const latest = volumes.length
    ? volumes.reduce((a, b) => (b.volume > a.volume ? b : a))
    : null;
  const owned = Number(volumesOwned) || 0;

  return {
    loading,
    volumes,
    latest,
    // the one they need next, once we know what they own
    next: owned ? (volumes.find((v) => v.volume === owned + 1) ?? null) : null,
    caughtUp: Boolean(latest && owned > 0 && owned >= latest.volume),
    seriesName: state.data?.info?.name ?? state.data?.name ?? name ?? "",
  };
}

export type BuyOptions = ReturnType<typeof useBuyOptions>;

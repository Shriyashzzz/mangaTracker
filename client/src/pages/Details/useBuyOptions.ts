import { useEffect, useState } from "react";
import { getSeries } from "../../lib/prices";
import type { Series, SeriesVolume } from "../../lib/types";
import { owns } from "../../lib/ownedVolumes";

// a volume we know the number of
export type NumberedVolume = SeriesVolume & { volume: number };

// what can be bought of this manga: the red bar and the Buy it box both need it,
// so it's asked for once here
export function useBuyOptions(
  name: string | null,
  // what they own: "up to" a volume, or the exact list with gaps
  owned: { volumesOwned: number | null; ownedList?: number[] },
) {
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
  const highest = Number(owned.volumesOwned) || 0;
  // the first one on sale they don't have: a gap (One Piece 1 and 4 -> vol. 2)
  // before the one after their furthest
  const missing = highest
    ? volumes
        // whole volumes from 1: a "vol. 0" special or a 10.5 isn't next
        .filter(
          (v) =>
            v.volume >= 1 &&
            Number.isInteger(v.volume) &&
            !owns(owned, v.volume),
        )
        .reduce<NumberedVolume | null>(
          (a, b) => (!a || b.volume < a.volume ? b : a),
          null,
        )
    : null;

  return {
    loading,
    volumes,
    latest,
    // the one they need next, once we know what they own
    next: missing,
    // nothing on sale they're missing, gaps included
    caughtUp: Boolean(latest && highest > 0 && !missing),
    seriesName: state.data?.info?.name ?? state.data?.name ?? name ?? "",
  };
}

export type BuyOptions = ReturnType<typeof useBuyOptions>;

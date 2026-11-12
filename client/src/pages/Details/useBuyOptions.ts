import { onSale } from "../../lib/releaseDate";
import { useEffect, useState } from "react";
import { getSeries } from "../../lib/prices";
import type { Series, SeriesVolume } from "../../lib/types";
import { nextToGet, owns, ownsAny } from "../../lib/ownedVolumes";
import { finishCost, stillToGet } from "../../lib/finishCost";

// a volume we know the number of
type NumberedVolume = SeriesVolume & { volume: number };

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
  // what's on sale now: a preorder isn't the newest out or next to buy
  const out = onSale(volumes);
  const latest = out.length
    ? out.reduce((a, b) => (b.volume > a.volume ? b : a))
    : null;
  const highest = Number(owned.volumesOwned) || 0;
  // the first one on sale after the furthest they own (only 2 -> vol. 3)
  const nextNumber = nextToGet(
    owned,
    out.map((v) => v.volume),
  );
  const missing =
    nextNumber == null
      ? null
      : (out.find((v) => v.volume === nextNumber) ?? null);

  // the gaps before the furthest they own: "Next for you" goes past them (a
  // gap was read some other way, as a rule), but a collector filling a run
  // wants to see them. Whole volumes out now, in order
  const gaps = out
    .filter(
      (v) =>
        Number.isInteger(v.volume) &&
        v.volume >= 1 &&
        v.volume < highest &&
        !owns(owned, v.volume),
    )
    .sort((a, b) => a.volume - b.volume);

  return {
    loading,
    volumes,
    latest,
    gaps,
    // the one they need next, once we know what they own
    next: missing,
    // nothing on sale after the furthest they own
    caughtUp: Boolean(latest && highest > 0 && !missing),
    // what the rest of the series costs at stored prices, once they own any
    finish: ownsAny(owned) ? finishCost(stillToGet(out, owned), out) : null,
    seriesName: state.data?.info?.name ?? state.data?.name ?? name ?? "",
  };
}

export type BuyOptions = ReturnType<typeof useBuyOptions>;

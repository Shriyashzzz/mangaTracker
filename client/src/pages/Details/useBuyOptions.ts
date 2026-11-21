import { onSale } from "../../lib/releaseDate";
import { useEffect, useState } from "react";
import { getSeries } from "../../lib/prices";
import type { Series, SeriesVolume } from "../../lib/types";
import { buyNextOf, nextToGet, owns } from "../../lib/ownedVolumes";
import { useNextFor } from "../../lib/prefs";

// a volume we know the number of
type NumberedVolume = SeriesVolume & { volume: number };

// what can be bought of this manga: the red bar and the Buy it box both need it,
// so it's asked for once here
export function useBuyOptions(
  name: string | null,
  // what they own: "up to" a volume, or the exact list with gaps
  owned: { volumesOwned: number | null; ownedList?: number[] },
  // with none owned: the volume their next chapter is in, when known (a
  // reader who finished the anime at chapter 38 wants the book with 39)
  readingFrom: number | null = null,
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

  // "Next for you": the volume after their furthest, or their first gap
  // when they've chosen that (Settings, Your shelf)
  const nextFor = useNextFor();
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
  // the first one on sale after the furthest they own (only 2 -> vol. 3);
  // owning none, the one their next chapter is in, or the first after it
  const onSaleNumbers = out.map((v) => v.volume);
  // the next after theirs, else their first gap (buyNextOf, the one rule);
  // owning none, the one their next chapter is in, or the first after it
  const nextNumber =
    highest === 0 && readingFrom
      ? (onSaleNumbers
          .filter((v) => Number.isInteger(v) && v >= readingFrom)
          .sort((a, b) => a - b)[0] ?? null)
      : buyNextOf(owned, onSaleNumbers, nextFor === "gap");
  const missing =
    nextNumber == null
      ? null
      : (out.find((v) => v.volume === nextNumber) ?? null);
  // what Next settled on is one of their gaps
  const nextIsGap = missing != null && missing.volume < highest;
  // something out past the furthest they own
  const newerOut = nextToGet(owned, onSaleNumbers) != null;

  // the gaps before the furthest they own: "Next for you" goes past them (a
  // gap was read some other way, as a rule), but a collector filling a run
  // wants to see them. Every number, in order, with its book when the
  // catalog lists one (it lists only some of Detective Conan's 60–69)
  const bookOf = new Map(
    out.filter((v) => Number.isInteger(v.volume)).map((v) => [v.volume, v]),
  );
  const gaps: { volume: number; isbn13?: string; title?: string }[] = [];
  for (let n = 1; n < highest; n++) {
    if (owns(owned, n)) continue;
    const book = bookOf.get(n);
    gaps.push(
      book
        ? { volume: n, isbn13: book.isbn13, title: book.title }
        : { volume: n },
    );
  }

  // the volume after their furthest when the catalogs list no book for it
  // (Hunter x Hunter's 15: only knock-off reprints, prices/singlesRules.ts):
  // still the one they need, never skipped for the next one that has a book
  const after = highest + 1;
  const unlisted =
    !(nextIsGap && nextFor === "gap") &&
    highest > 0 &&
    latest &&
    after <= latest.volume &&
    !bookOf.has(after)
      ? after
      : null;

  return {
    loading,
    volumes,
    latest,
    gaps,
    // the one they need next, once we know what they own
    next: unlisted != null ? null : missing,
    // the next one's number when no book of it is listed
    unlisted,
    // nothing on sale after the furthest they own (gaps or not)
    caughtUp: Boolean(latest && highest > 0 && !newerOut && unlisted == null),
    seriesName: state.data?.info?.name ?? state.data?.name ?? name ?? "",
  };
}

export type BuyOptions = ReturnType<typeof useBuyOptions>;

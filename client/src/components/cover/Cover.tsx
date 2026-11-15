// A cover picture, from any of the places covers come from, at the size
// it's drawn. Give it the cover's address and how wide it's drawn (`sizes`,
// as an <img> takes it: "110px", or "(max-width: 720px) 110px, 156px"); it
// offers the browser every width the server makes (lib/coverSizes.ts) and
// the browser fetches the one that suits the slot and the screen.
//
// It also does what every cover needs: loads only when it's near the screen
// (unless `eager`, for the one cover a page opens on), hides itself when it
// fails or turns out to be a store's "no image" picture, so the stand-in
// drawn behind it shows (lib/prices.ts hideBrokenCover).
//
// On a slow or data-saving connection (where the browser says so: Chrome
// and Android, not Safari or Firefox) only the narrower widths are offered.
import {
  coverChoices,
  forSlowConnection,
  isOwnPick,
  isVolumeCover,
} from "../../lib/coverSizes";
import {
  coverSrc,
  hideBrokenCover,
  hidePlaceholderCover,
} from "../../lib/prices";

type Connection = { saveData?: boolean; effectiveType?: string };
// "slow-2g", "2g" and "3g" are the browser's own words for a slow one
const isSlow = () => {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: Connection })
    .connection;
  return Boolean(
    connection?.saveData || /(^|-)[23]g$/.test(connection?.effectiveType ?? ""),
  );
};

type Props = {
  url?: string | null;
  // how wide it's drawn, as an <img>'s `sizes`
  sizes: string;
  alt?: string;
  className?: string;
  // the page's main cover: fetched straight away, not when it scrolls near
  eager?: boolean;
  // another cover to show if this one fails (a series' AniList cover, when
  // the first volume's own won't load), before the stand-in
  fallbackUrl?: string | null;
  // it's this series' cover: the English one is shown where we know it
  // (lib/coverSizes.ts). Prefer SeriesPicture, which also draws a cover
  // when there's none
  series?: string;
  // New's In Japan side: the Japanese cover first, then the English one
  japanFirst?: boolean;
  // called when there's no picture to show after all, for a page that draws
  // something else in its place (the shelf letters the series' name)
  onFail?: () => void;
};

export default function Cover({
  url,
  sizes,
  alt = "",
  className,
  eager = false,
  fallbackUrl,
  series,
  japanFirst,
  onFail,
}: Props) {
  const all = coverChoices(
    url,
    series ? { name: series, japanFirst } : undefined,
  );
  if (!all.length) return null;
  // a catalog's cover we can't resize (MyAnimeList's, Kitsu's): shown as it
  // is if the series has no English one
  const asGiven = series && url && !isOwnPick(url) ? url : null;
  const fallback = fallbackUrl ?? (all[0]!.url === url ? null : asGiven);
  const choices = isSlow() ? forSlowConnection(all) : all;
  const hasSizes = choices.length > 1;
  return (
    <img
      // for a browser that can't choose: the narrowest
      src={coverSrc(choices[0]!.url)}
      srcSet={
        hasSizes
          ? choices.map((c) => `${coverSrc(c.url)} ${c.width}w`).join(", ")
          : undefined
      }
      sizes={hasSizes ? sizes : undefined}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={(e) => {
        const img = e.currentTarget;
        if (fallback && img.dataset.fellBack !== "yes") {
          img.dataset.fellBack = "yes";
          img.removeAttribute("srcset");
          img.removeAttribute("sizes");
          img.src = coverSrc(fallback)!;
          return;
        }
        // tries again a couple of times, then hides it
        hideBrokenCover(e);
        if (img.hidden) onFail?.();
      }}
      onLoad={(e) => {
        if (!url || !isVolumeCover(url)) return;
        hidePlaceholderCover(e);
        if (e.currentTarget.hidden) onFail?.();
      }}
    />
  );
}

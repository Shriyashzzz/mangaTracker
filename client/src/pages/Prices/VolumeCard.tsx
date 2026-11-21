import { StarIcon } from "../../components/icons/Icons";
import { scoreText } from "./reviews/reviewText";
import { NavLink } from "react-router";
import Cover from "../../components/cover/Cover";
import { formatCents, novelParts, volumePath } from "../../lib/prices";
import { stayInTrip, useFromShelf } from "../../lib/fromShelf";
import { pricesStyles as styles } from "./styles";

// one volume: cover, volume tag, title and, when we have one, the best known
// price. Used by search, series and home sections.

// how wide a card's cover is drawn (110 to 130px on a phone, up to about
// 160px on a laptop), and a small tile's, for the Cover to pick a size by
const CARD_COVER = "(max-width: 720px) 130px, 160px";
const TILE_COVER = "60px";

// What sits behind a volume's own cover, showing when it's missing: the
// series' cover, standing in (the English one where we know it, found by
// `seriesName`; see components/cover/SeriesPicture.tsx for the order). For vol. 1 that picture is its
// own art, so it's shown as it is. For any other volume it's a stand-in:
// washed out, with the volume's number over it, so it's never taken for
// that volume's real cover. With no series cover either, the drawn number.
//
// `numbered`: the card already carries the number on its corner tab
// (VolumeCard), so it isn't stamped a second time.
// `small`: for a small tile (the shelf's Volumes tab), the drawn number is
// drawn smaller
// `plain`: the series cover as it is, not washed out (a series page's grid,
// where each card's corner tab already says which volume it is)
export function CoverFallback({
  number,
  seriesCoverUrl,
  seriesName,
  numbered = false,
  small = false,
  plain = false,
}: {
  number?: number | null;
  seriesCoverUrl?: string | null;
  seriesName?: string;
  numbered?: boolean;
  small?: boolean;
  plain?: boolean;
}) {
  const isItsOwnArt = number == null || number <= 1 || (plain && numbered);
  const drawn = small ? styles.coverFallbackSmall : styles.coverFallback;
  if (!seriesCoverUrl || isItsOwnArt)
    return (
      <span className={drawn} aria-hidden>
        {number ?? "?"}
        <Cover
          url={seriesCoverUrl}
          series={seriesName}
          sizes={small ? TILE_COVER : CARD_COVER}
          className={styles.seriesFallback}
        />
      </span>
    );
  return (
    <span className={drawn} aria-hidden>
      {/* under the picture: shows if the series cover fails to load too */}
      {number}
      <Cover
        url={seriesCoverUrl}
        series={seriesName}
        sizes={small ? TILE_COVER : CARD_COVER}
        className={small ? styles.seriesStandInSmall : styles.seriesStandIn}
      />
      <span className={small ? styles.standInVeilSmall : styles.standInVeil} />
      {!numbered && <span className={styles.standInNumber}>{number}</span>}
    </span>
  );
}

export default function VolumeCard({
  isbn13,
  title,
  // the book's full title when `title` is a short label like "Vol. 3"
  fullTitle,
  volume,
  coverUrl,
  seriesCoverUrl,
  seriesName,
  subtitle,
  priceCents,
  wasCents,
  mark,
  holds,
  rating,
  plainStandIn = false,
  titleOnCover = false,
  bookNumber = null,
}: {
  // none for a book no catalog lists yet: it's drawn, but opens nothing
  isbn13: string | null;
  title: string;
  fullTitle?: string;
  volume?: number | null;
  coverUrl?: string | null;
  seriesCoverUrl?: string | null;
  // the series it belongs to, for the stand-in to be its English cover
  seriesName?: string;
  subtitle?: string;
  priceCents?: number | null;
  // the usual price, struck through when this one is a deal
  wasCents?: number | null;
  // on a series page, for a series on their shelf: one they own, or the
  // next one they need
  mark?: "yours" | "next";
  // a book holding several volumes (Vinland Saga, Book 5 is vols 9 and 10):
  // drawn as a fanned stack of that many cards, tagged with its volumes
  holds?: { from: number; to: number };
  // readers' average rating of it, on a series page: a small score on the
  // cover's corner, which is how reviews get found from the grid
  rating?: number | null;
  // a missing cover shows the series' plainly, not washed out (CoverFallback)
  plainStandIn?: boolean;
  // the title only says what the cover's own "Vol. 13" badge says: in the
  // app it's left to screen readers (index.css .app-said-above)
  titleOnCover?: boolean;
  // a book holding several volumes: the number its stand-in cover shows
  // (VIZBIG 4 is "4"), its badge saying the volumes
  bookNumber?: number | null;
}) {
  const fromShelf = useFromShelf();
  const shown = novelParts(title);
  const inner = (
    <>
      <span className={holds ? styles.stack : "contents"}>
        {holds &&
          Array.from({ length: holds.to - holds.from }, (_, i) => (
            <span
              key={i}
              className={`card-stack-back ${styles.stackBack} group-hover:translate-x-1`}
              style={{
                rotate: `calc(${5 * (holds.to - holds.from - i)}deg * var(--fan) * var(--fan-dir))`,
                translate: `calc(${8 * (holds.to - holds.from - i)}px * var(--fan) * var(--fan-dir)) calc(${-4 * (holds.to - holds.from - i)}px * var(--fan))`,
              }}
              aria-hidden
            >
              <Cover url={coverUrl} sizes={CARD_COVER} />
            </span>
          ))}
        <span className={styles.cover}>
          <CoverFallback
            number={volume ?? bookNumber}
            seriesCoverUrl={seriesCoverUrl}
            seriesName={seriesName}
            numbered={volume != null}
            plain={plainStandIn}
          />
          <Cover url={coverUrl} sizes={CARD_COVER} />
          {mark && (
            <span
              className={`card-mark ${mark === "next" ? styles.markNext : styles.markYours}`}
            >
              {mark === "next" ? "Next" : "Yours"}
            </span>
          )}
          {rating != null && (
            <span
              className={styles.coverRating}
              aria-label={`Readers rate it ${scoreText(rating)} out of 5`}
            >
              <StarIcon filled aria-hidden />
              {scoreText(rating)}
            </span>
          )}
          {holds ? (
            // data-range: a book's "Vols. 34–36", which needs a wider cover
            // than a volume's number (index.css .app-cover-grid)
            <span className={`card-vol ${styles.vol}`} data-range>
              <small>Vols.</small>
              {holds.from}–{holds.to}
            </span>
          ) : (
            volume != null && (
              <span className={`card-vol ${styles.vol}`}>
                <small>Vol.</small>
                {volume}
              </span>
            )
          )}
        </span>
      </span>
      <span
        className={`${styles.cardTitle} ${titleOnCover ? "app-said-above" : ""}`}
      >
        {shown.title}
      </span>
      {/* said where it's named in full (deals, recently checked), where manga
          and novels sit together; a series page's "Vol. 3" is the page's */}
      {(subtitle || shown.lightNovel) && (
        <span className={styles.cardMeta}>
          {[
            shown.lightNovel && "Light novel",
            subtitle && novelParts(subtitle).title,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
      {priceCents != null && (
        <span className={styles.cardPrice}>
          {formatCents(priceCents)}
          {wasCents != null && (
            // relative: the hidden word stays inside the sideways-scrolling row,
            // or it stretches the whole page on phones
            <s className={`relative ${styles.cardWas}`}>
              <span className="sr-only">usually </span>
              {formatCents(wasCents)}
            </s>
          )}
        </span>
      )}
    </>
  );
  // a book no catalog lists yet (an edition's): drawn the same, opening nothing
  if (!isbn13) return <div className={styles.card}>{inner}</div>;
  return (
    <NavLink
      to={volumePath(isbn13, fullTitle ?? title)}
      className={styles.card}
      viewTransition
      {...stayInTrip(fromShelf)}
    >
      {inner}
    </NavLink>
  );
}

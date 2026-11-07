import { NavLink } from "react-router";
import {
  coverSrc,
  formatCents,
  hideBrokenCover,
  hidePlaceholderCover,
  novelParts,
  volumePath,
} from "../../lib/prices";
import { stayInTrip, useFromShelf } from "../../lib/fromShelf";
import { pricesStyles as styles } from "./styles";

// one volume: cover, volume tag, title and, when we have one, the best known
// price. Used by search, series and home sections. Without this edition's
// cover it shows the series cover from AniList when the page has it, and a
// drawn volume number when it doesn't
// what sits behind a volume's own cover, showing when it's missing
export function CoverFallback({
  number,
  seriesCoverUrl,
}: {
  number?: number | null;
  seriesCoverUrl?: string | null;
}) {
  return (
    <span className={styles.coverFallback} aria-hidden>
      {number ?? "?"}
      {seriesCoverUrl && (
        <img
          className={styles.seriesFallback}
          src={seriesCoverUrl}
          alt=""
          loading="lazy"
          onError={hideBrokenCover}
          onLoad={hidePlaceholderCover}
        />
      )}
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
  subtitle,
  priceCents,
  wasCents,
  mark,
  holds,
}: {
  isbn13: string;
  title: string;
  fullTitle?: string;
  volume?: number | null;
  coverUrl?: string | null;
  seriesCoverUrl?: string | null;
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
}) {
  const fromShelf = useFromShelf();
  const shown = novelParts(title);
  return (
    <NavLink
      to={volumePath(isbn13, fullTitle ?? title)}
      className={styles.card}
      viewTransition
      {...stayInTrip(fromShelf)}
    >
      <span className={holds ? styles.stack : "contents"}>
        {holds &&
          Array.from({ length: holds.to - holds.from }, (_, i) => (
            <span
              key={i}
              className={`${styles.stackBack} group-hover:translate-x-1`}
              style={{
                rotate: `${5 * (holds.to - holds.from - i)}deg`,
                translate: `${8 * (holds.to - holds.from - i)}px ${-4 * (holds.to - holds.from - i)}px`,
              }}
              aria-hidden
            >
              {coverUrl && (
                <img src={coverSrc(coverUrl)} alt="" loading="lazy" />
              )}
            </span>
          ))}
        <span className={styles.cover}>
          <CoverFallback number={volume} seriesCoverUrl={seriesCoverUrl} />
          {coverUrl && (
            <img
              src={coverSrc(coverUrl)}
              alt=""
              loading="lazy"
              onError={hideBrokenCover}
              onLoad={hidePlaceholderCover}
            />
          )}
          {mark && (
            <span
              className={mark === "next" ? styles.markNext : styles.markYours}
            >
              {mark === "next" ? "Next" : "Yours"}
            </span>
          )}
          {holds ? (
            <span className={styles.vol}>
              <small>Vols.</small>
              {holds.from}–{holds.to}
            </span>
          ) : (
            volume != null && (
              <span className={styles.vol}>
                <small>Vol.</small>
                {volume}
              </span>
            )
          )}
        </span>
      </span>
      <span className={styles.cardTitle}>{shown.title}</span>
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
    </NavLink>
  );
}

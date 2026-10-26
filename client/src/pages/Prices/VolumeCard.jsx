import { NavLink } from "react-router";
import { coverSrc, formatCents, hideBrokenCover } from "../../lib/prices";
import styles from "./Prices.module.css";

// one volume: cover, volume tag, title and, when we have one, the best known
// price. Used by search, series and home sections. Without this edition's
// cover it shows the series cover from AniList when the page has it, and a
// drawn volume number when it doesn't
// what sits behind a volume's own cover, showing when it's missing
export function CoverFallback({ number, seriesCoverUrl }) {
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
        />
      )}
    </span>
  );
}

export default function VolumeCard({
  isbn13,
  title,
  volume,
  coverUrl,
  seriesCoverUrl,
  subtitle,
  priceCents,
  wasCents,
}) {
  return (
    <NavLink to={`/prices/${isbn13}`} className={styles.card} viewTransition>
      <span className={styles.cover}>
        <CoverFallback number={volume} seriesCoverUrl={seriesCoverUrl} />
        {coverUrl && (
          <img
            src={coverSrc(coverUrl)}
            alt=""
            loading="lazy"
            onError={hideBrokenCover}
          />
        )}
        {volume != null && <span className={styles.vol}>Vol. {volume}</span>}
      </span>
      <span className={styles.cardTitle}>{title}</span>
      {subtitle && <span className={styles.cardMeta}>{subtitle}</span>}
      {priceCents != null && (
        <span className={styles.cardPrice}>
          {formatCents(priceCents)}
          {wasCents != null && (
            <s className={styles.cardWas}>{formatCents(wasCents)}</s>
          )}
        </span>
      )}
    </NavLink>
  );
}

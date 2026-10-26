import { NavLink } from "react-router";
import { coverSrc, formatCents, hideBrokenCover } from "../../lib/prices";
import styles from "./Prices.module.css";

// one volume: cover (with a drawn fallback), volume tag, title and, when we
// have one, the best known price. Used by search, series and home sections
export default function VolumeCard({
  isbn13,
  title,
  volume,
  coverUrl,
  subtitle,
  priceCents,
  wasCents,
}) {
  return (
    <NavLink to={`/prices/${isbn13}`} className={styles.card} viewTransition>
      <span className={styles.cover}>
        <span className={styles.coverFallback} aria-hidden>
          {volume ?? "?"}
        </span>
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

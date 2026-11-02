import { NavLink } from "react-router";
import { formatCents, seriesPath, volumePath } from "../../lib/prices";
import { detailsStyles as styles } from "./styles";
import type { SeriesVolume } from "../../lib/types";
import type { BuyOptions } from "./useBuyOptions";

// where to buy more of this manga: the next volume they need, the newest in the
// US, and the whole series' prices. Stays out of the way when the series can't be
// found under the name on the shelf
type Props = {
  options: BuyOptions;
  // the red bar is already selling the next volume
  hideNext: boolean;
};

const price = (v: SeriesVolume) =>
  v.knownPriceCents != null ? formatCents(v.knownPriceCents) : "check price";

export default function BuyStrip({ options, hideNext }: Props) {
  const { loading, volumes, latest, next, caughtUp, seriesName } = options;

  if (loading) {
    return <div className={`skeleton ${styles.buySkeleton}`} aria-hidden />;
  }
  if (!latest) return null;

  return (
    <section className={styles.buy} aria-labelledby="buy-title">
      <h2 id="buy-title" className={styles.deskTitle}>
        Buy it
      </h2>
      <ul className={styles.buyList}>
        {next && !hideNext && (
          <li>
            <NavLink className={styles.buyLink} to={volumePath(next.isbn13, next.title)} viewTransition>
              <span className={styles.buyKind}>Next for you</span>
              <span>Vol. {next.volume}</span>
              <span className={styles.buyPrice}>{price(next)}</span>
            </NavLink>
          </li>
        )}
        {caughtUp ? (
          <li className={styles.buyNote}>
            <span className={styles.buyKind}>Caught up</span>
            Vol. {latest.volume} is the newest in English
          </li>
        ) : (
          next?.isbn13 !== latest.isbn13 && (
            <li>
              <NavLink
                className={styles.buyLink}
                to={volumePath(latest.isbn13, latest.title)}
                viewTransition
              >
                <span className={styles.buyKind}>Newest</span>
                <span>Vol. {latest.volume}</span>
                <span className={styles.buyPrice}>{price(latest)}</span>
              </NavLink>
            </li>
          )
        )}
      </ul>
      {/* a way to look further, not something to buy, so not a ticket */}
      <NavLink className={styles.buySeries} to={seriesPath(seriesName)} viewTransition>
        {volumes.length === 1 ? "The series" : `All ${volumes.length} volumes`} →
      </NavLink>
    </section>
  );
}

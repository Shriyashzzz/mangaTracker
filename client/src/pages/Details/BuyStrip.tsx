import { NavLink } from "react-router";
import { formatCents, seriesPath, volumePath } from "../../lib/prices";
import { finishMoney } from "../../lib/finishCost";
import { onSale } from "../../lib/releaseDate";
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

// gaps listed by name; past this, the series page's "Not on your shelf"
const GAPS_SHOWN = 6;

export default function BuyStrip({ options, hideNext }: Props) {
  const { loading, volumes, latest, next, caughtUp, finish, seriesName, gaps } =
    options;
  // as the shelf counts them: up to the newest one out, listed or not
  // (Detective Conan: 98, though only 65 have a book listed)
  const out = onSale(volumes);
  const outCount = Math.max(
    out.length,
    ...out.map((v) => v.volume).filter(Number.isInteger),
  );
  const coming = volumes.length - out.length;

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
            <NavLink
              className={styles.buyNext}
              to={volumePath(next.isbn13, next.title)}
              viewTransition
            >
              <span className={styles.buyNextKind}>Next for you</span>
              <span>Vol. {next.volume}</span>
              <span className={styles.buyPrice}>{price(next)}</span>
            </NavLink>
          </li>
        )}
        {/* the gaps behind them: Next goes past these, a collector filling
            the run wants each one */}
        {gaps.length > 0 && (
          <li className={styles.buyGaps}>
            <span className={styles.buyKind}>Missing</span>
            <span className={styles.buyGapList}>
              {gaps.slice(0, GAPS_SHOWN).map((g) => (
                <NavLink
                  key={g.isbn13}
                  to={volumePath(g.isbn13, g.title)}
                  className={styles.buyGap}
                  viewTransition
                >
                  Vol. {g.volume}
                </NavLink>
              ))}
              {gaps.length > GAPS_SHOWN && (
                <NavLink
                  // seriesPath already has its ?name=, so this joins with &
                  to={`${seriesPath(seriesName)}&toget=1`}
                  className={styles.buyGap}
                  viewTransition
                >
                  +{gaps.length - GAPS_SHOWN} more
                </NavLink>
              )}
            </span>
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
        {finish && (
          <li>
            <NavLink
              className={styles.buyLink}
              // seriesPath already has its ?name=, so this joins with &
              to={`${seriesPath(seriesName)}&toget=1`}
              title="At the last checked prices. A volume gets a price once someone opens its page"
              viewTransition
            >
              <span className={styles.buyKind}>Finish the series</span>
              <span className={styles.buyCount}>
                <span>
                  {finish.left} vol{finish.left === 1 ? "" : "s"}
                </span>
                {finish.priced < finish.left && (
                  <em className={styles.buyAside}>(est)</em>
                )}
              </span>
              <span className={styles.buyPrice}>
                {finishMoney(finish, formatCents)}
              </span>
            </NavLink>
          </li>
        )}
      </ul>
      {/* a way to look further, not something to buy, so not a ticket */}
      <NavLink
        className={styles.buySeries}
        to={seriesPath(seriesName)}
        viewTransition
      >
        {/* out now, as the shelf's "of 15" counts them; preorders apart */}
        {outCount <= 1 && !coming
          ? "The series"
          : `All ${outCount} volumes${coming ? ` + ${coming} coming` : ""}`}{" "}
        →
      </NavLink>
    </section>
  );
}

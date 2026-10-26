import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  formatCents,
  getSeries,
  seriesPath,
  volumePath,
} from "../../lib/prices";
import styles from "./Details.module.css";

// where to buy more of this manga: the newest US volume, the one with the
// lowest price we've seen (at the stores we check, so not a promise of the
// cheapest anywhere), and the whole series' prices. Stays out of the way when the
// series can't be found under the name on the shelf
// With `volumesOwned` ("up to Vol. 14") it leads with the next one they need
export default function BuyStrip({ name, volumesOwned }) {
  const [state, setState] = useState({ name: null, data: null });

  useEffect(() => {
    const controller = new AbortController();
    getSeries(name, controller.signal)
      .then((data) => setState({ name, data }))
      .catch((e) => {
        if (e.name !== "AbortError") setState({ name, data: null });
      });
    return () => controller.abort();
  }, [name]);

  if (state.name !== name) {
    return <div className={`skeleton ${styles.buySkeleton}`} aria-hidden />;
  }
  const volumes = state.data?.volumes?.filter((v) => v.volume != null) ?? [];
  if (!volumes.length) return null;

  const latest = volumes.reduce((a, b) => (b.volume > a.volume ? b : a));
  const owned = Number(volumesOwned) || 0;
  const caughtUp = owned > 0 && owned >= latest.volume;
  const next = owned ? volumes.find((v) => v.volume === owned + 1) : null;
  // once we know what they own, the lowest price only counts among the
  // volumes they still need
  const cheapest = volumes
    .filter((v) => v.knownPriceCents != null && v.volume > owned)
    .reduce(
      (a, b) => (!a || b.knownPriceCents < a.knownPriceCents ? b : a),
      null,
    );
  const seriesName = state.data.info?.name ?? state.data.name;

  const price = (v) =>
    v.knownPriceCents != null ? formatCents(v.knownPriceCents) : "check price";

  return (
    <section className={styles.buy} aria-labelledby="buy-title">
      <h2 id="buy-title" className={styles.label}>
        Buy the volumes
      </h2>
      <ul className={styles.buyList}>
        {next && (
          <li>
            <NavLink to={volumePath(next.isbn13, next.title)} viewTransition>
              <span className={styles.buyKind}>Next for you</span>
              Vol. {next.volume}
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
                to={volumePath(latest.isbn13, latest.title)}
                viewTransition
              >
                <span className={styles.buyKind}>Newest</span>
                Vol. {latest.volume}
                <span className={styles.buyPrice}>{price(latest)}</span>
              </NavLink>
            </li>
          )
        )}
        {cheapest &&
          cheapest.isbn13 !== latest.isbn13 &&
          cheapest.isbn13 !== next?.isbn13 && (
            <li>
              <NavLink
                to={volumePath(cheapest.isbn13, cheapest.title)}
                title="The lowest price we've seen at the stores we check"
                viewTransition
              >
                <span className={styles.buyKind}>Lowest seen</span>
                Vol. {cheapest.volume}
                <span className={styles.buyPrice}>{price(cheapest)}</span>
              </NavLink>
            </li>
          )}
        <li>
          <NavLink to={seriesPath(seriesName)} viewTransition>
            <span className={styles.buyKind}>Series</span>
            All {volumes.length} volumes →
          </NavLink>
        </li>
      </ul>
    </section>
  );
}

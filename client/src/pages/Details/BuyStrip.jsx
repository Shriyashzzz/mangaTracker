import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  formatCents,
  getSeries,
  seriesPath,
  volumePath,
} from "../../lib/prices";
import styles from "./Details.module.css";

// where to buy more of this manga: the newest US volume, the cheapest one
// we've seen, and the whole series' prices. Stays out of the way when the
// series can't be found under the name on the shelf
export default function BuyStrip({ name }) {
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
  const cheapest = volumes
    .filter((v) => v.knownPriceCents != null)
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
        <li>
          <NavLink to={volumePath(latest.isbn13, latest.title)} viewTransition>
            <span className={styles.buyKind}>Newest</span>
            Vol. {latest.volume}
            <span className={styles.buyPrice}>{price(latest)}</span>
          </NavLink>
        </li>
        {cheapest && cheapest.isbn13 !== latest.isbn13 && (
          <li>
            <NavLink
              to={volumePath(cheapest.isbn13, cheapest.title)}
              viewTransition
            >
              <span className={styles.buyKind}>Cheapest</span>
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

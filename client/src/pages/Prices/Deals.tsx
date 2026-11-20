// /deals: volumes whose cheapest new copy now is well under their usual new
// price, biggest discount first. Stored prices only (server: getDealsPage),
// so it never sets off a check; each card goes to the volume's page, where
// every store's price is. 20 to a page (useUrlPages)
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import RangePager from "../../components/rangePager/RangePager";
import { useUrlPages } from "../../components/rangePager/useUrlPages";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { getDeals } from "../../lib/prices";
import { inCanada } from "../../lib/country";
import { usePageMeta } from "../../lib/seo";
import type { PriceCard } from "../../lib/types";
import VolumeCard from "./VolumeCard";
import { pricesStyles as styles } from "./styles";

const percentOff = (d: PriceCard) =>
  Math.round(100 - (100 * d.priceCents) / (d.avgCents ?? d.priceCents));

export default function Deals() {
  // deals are worked out from US prices only, for now: someone shopping in
  // Canada is told so rather than shown US prices
  const canada = inCanada();
  const [state, setState] = useState<{
    deals: PriceCard[] | null;
    error: boolean;
  }>({ deals: null, error: false });

  useEffect(() => {
    if (canada) return;
    const controller = new AbortController();
    getDeals(controller.signal)
      .then((r) => setState({ deals: r.deals, error: false }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ deals: null, error: true });
      });
    return () => controller.abort();
  }, [canada]);

  const { pageItems, pager } = useUrlPages(state.deals ?? [], "deals-list");

  usePageMeta({
    // as the site server's (client/server.ts dealsTags)
    title: "Manga deals: volumes under their usual price",
    screen: "Deals",
    description:
      "English manga volumes selling for less than they usually do right now, from the prices Manga Tracker checks across US stores. Biggest discounts first.",
    path: "/deals",
  });

  return (
    <div className={`${styles.page} fade-in`}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <NavLink to="/" className="tap" viewTransition>
          Price check
        </NavLink>
        <span aria-hidden>/</span>
        <span aria-current="page">Deals</span>
      </nav>
      <header className={styles.sectionHead}>
        <h1 className={styles.title}>Manga deals</h1>
        <p className={styles.sub}>
          Volumes selling for less than they usually do, biggest discount first.
          Open one to see every store's price.
        </p>
      </header>

      {canada && (
        <div className={styles.empty}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={styles.emptyTitle}>Deals are US-only for now.</p>
          <p>
            Open any volume to see its prices in Canada.{" "}
            <NavLink to="/series" viewTransition>
              Browse every series
            </NavLink>
          </p>
        </div>
      )}

      {!canada && state.deals === null && !state.error && (
        <div aria-busy="true" aria-label="Loading">
          <SlowLoadQuote />
          <div className={styles.grid}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className={`skeleton ${styles.cardSkeleton}`} />
            ))}
          </div>
        </div>
      )}

      {state.error && (
        <div className={styles.empty} role="alert">
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="panic" />
          </span>
          <p className={styles.emptyTitle}>Deals couldn't load.</p>
          <p>Try again in a moment.</p>
        </div>
      )}

      {state.deals?.length === 0 && (
        <div className={styles.empty}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={styles.emptyTitle}>No deals right now.</p>
          <p>
            Nothing is well under its usual price at the moment.{" "}
            <NavLink to="/series" viewTransition>
              Browse every series
            </NavLink>
          </p>
        </div>
      )}

      {state.deals && state.deals.length > 0 && (
        <>
          <div id="deals-list" className="scroll-mt-4" />
          <ul className={styles.grid}>
            {pageItems.map((d) => (
              <li key={d.isbn13}>
                <VolumeCard
                  {...d}
                  priceCents={d.priceCents}
                  wasCents={d.avgCents}
                  subtitle={`${percentOff(d)}% under its usual price`}
                />
              </li>
            ))}
          </ul>
          <RangePager {...pager} label="Deal pages" />
        </>
      )}
      {/* a short list isn't a broken one: deals come from prices as they're
          checked, so it grows and changes through the day */}
      {state.deals && state.deals.length > 0 && state.deals.length < 8 && (
        <p className={styles.sub}>
          That's all for now. More turn up as prices are checked through the
          day.
        </p>
      )}
    </div>
  );
}

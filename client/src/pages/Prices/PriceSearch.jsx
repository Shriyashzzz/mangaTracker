import { useEffect, useState } from "react";
import { NavLink, useOutletContext, useSearchParams } from "react-router";
import { getHighlights, searchSeries, seriesPath } from "../../lib/prices";
import SeriesSearchBox from "./SeriesSearchBox";
import VolumeCard from "./VolumeCard";
import styles from "./Prices.module.css";
import Mascot from "../../components/mascot/Mascot";

const QUICK_PICKS = ["One Piece", "Jujutsu Kaisen", "Chainsaw Man", "Frieren"];

export default function PriceSearch() {
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  // results are kept with the query they belong to, so a stale answer
  // never shows under a newer search
  const [result, setResult] = useState({ query: "", items: [], error: "" });

  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    searchSeries(query, controller.signal)
      .then((items) => setResult({ query, items, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError") {
          setResult({ query, items: [], error: e.message });
        }
      });
    return () => controller.abort();
  }, [query]);

  const searching = query.length >= 2;
  const loading = searching && result.query !== query;

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={styles.searchHead}>
        <h1 className={styles.title}>Price check</h1>
        <p className={styles.sub}>
          Find a series, then see what US stores charge for each volume.
        </p>

        <SeriesSearchBox initialQuery={query} autoFocus={!query} />

        {!searching && (
          <p className={styles.quick}>
            <span>Try</span>
            {QUICK_PICKS.map((pick) => (
              <NavLink key={pick} to={seriesPath(pick)} viewTransition>
                {pick}
              </NavLink>
            ))}
          </p>
        )}
      </header>

      {loading && (
        <div className={styles.grid} aria-busy="true" aria-label="Searching">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`skeleton ${styles.cardSkeleton}`} />
          ))}
        </div>
      )}

      {!loading && searching && result.error && (
        <div className={styles.empty} role="alert">
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="panic" />
          </span>
          <p className={styles.emptyTitle}>Couldn't search right now.</p>
          <p>{result.error}</p>
        </div>
      )}

      {!loading && searching && !result.error && result.items.length === 0 && (
        <div className={styles.empty}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={styles.emptyTitle}>No English series found.</p>
          <p>
            Try the name printed on the US cover, or paste the ISBN from the
            back of a volume.
          </p>
        </div>
      )}

      {!loading && searching && result.items.length > 0 && (
        <section aria-labelledby="results-title">
          <h2 id="results-title" className={styles.count} aria-live="polite">
            {result.items.length} series for “{query}”
          </h2>
          <ul className={styles.grid}>
            {result.items.map((s) => (
              <li key={s.slug}>
                <SeriesCard series={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!searching && <Highlights />}
      {!searching && <ShelfPromo />}
    </div>
  );
}

// one series: cover, name and what AniList knows about it
function SeriesCard({ series }) {
  return (
    <NavLink
      to={seriesPath(series.name)}
      className={styles.card}
      viewTransition
    >
      <span className={styles.cover}>
        <span className={styles.coverFallback} aria-hidden>
          ?
        </span>
        {series.coverUrl && <img src={series.coverUrl} alt="" loading="lazy" />}
      </span>
      <span className={styles.cardTitle}>{series.name}</span>
      <span className={styles.cardMeta}>
        {[
          series.year,
          series.volumes && `${series.volumes} vols`,
          series.score && `Score ${series.score}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </NavLink>
  );
}

// what to show before anyone searches: trending series (AniList), deals and
// recent checks (from prices already saved). None of it spends a search
function Highlights() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getHighlights(controller.signal)
      .then(setData)
      .catch(() => setData({ trending: [], deals: [], recent: [] }));
    return () => controller.abort();
  }, []);

  if (!data) {
    return (
      <div className={styles.grid} aria-busy="true" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`skeleton ${styles.cardSkeleton}`} />
        ))}
      </div>
    );
  }

  return (
    <>
      {data.trending.length > 0 && (
        <section aria-labelledby="trending-title">
          <h2 id="trending-title" className={styles.sectionTitle}>
            Popular this season
          </h2>
          <ul className={styles.row}>
            {data.trending.map((s) => (
              <li key={s.slug}>
                <SeriesCard series={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.deals.length > 0 && (
        <section aria-labelledby="deals-title">
          <h2 id="deals-title" className={styles.sectionTitle}>
            Latest deals
          </h2>
          <ul className={styles.row}>
            {data.deals.map((d) => (
              <li key={d.isbn13}>
                <VolumeCard
                  {...d}
                  priceCents={d.priceCents}
                  wasCents={d.avgCents}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.recent.length > 0 && (
        <section aria-labelledby="recent-title">
          <h2 id="recent-title" className={styles.sectionTitle}>
            Recently checked
          </h2>
          <ul className={styles.row}>
            {data.recent.map((r) => (
              <li key={r.isbn13}>
                <VolumeCard {...r} priceCents={r.priceCents} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// the second half of the app: a quiet pointer to the reading tracker
function ShelfPromo() {
  const [isSignedIn] = useOutletContext();
  return (
    <section className={styles.promo} aria-labelledby="promo-title">
      <div>
        <h2 id="promo-title" className={styles.sectionTitle}>
          Also: track what you read
        </h2>
        <p className={styles.promoBody}>
          Save the chapter you're on for every series, rate what you finish, and
          pick up right where you stopped.
        </p>
      </div>
      {isSignedIn ? (
        <NavLink to="/shelf" className="btn btn-secondary" viewTransition>
          Go to my shelf
        </NavLink>
      ) : (
        <NavLink to="/signup" className="btn btn-secondary" viewTransition>
          Start your shelf
        </NavLink>
      )}
    </section>
  );
}

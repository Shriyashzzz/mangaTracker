import { useEffect, useState } from "react";
import { NavLink, useSearchParams } from "react-router";
import { SearchIcon } from "../../components/icons/Icons";
import {
  getHighlights,
  searchVolumes,
  seriesName,
  seriesPath,
} from "../../lib/prices";
import VolumeCard from "./VolumeCard";
import styles from "./Prices.module.css";

const QUICK_PICKS = ["One Piece", "Jujutsu Kaisen", "Chainsaw Man", "Frieren"];

export default function PriceSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [draft, setDraft] = useState(query);
  // keep the box in step when the URL changes (back/forward, quick picks)
  const [shownQuery, setShownQuery] = useState(query);
  if (shownQuery !== query) {
    setShownQuery(query);
    setDraft(query);
  }
  // results are kept with the query they belong to, so a stale answer
  // never shows under a newer search
  const [result, setResult] = useState({ query: "", items: [], error: "" });

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    searchVolumes(query, controller.signal)
      .then((items) => setResult({ query, items, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError") {
          setResult({ query, items: [], error: e.message });
        }
      });
    return () => controller.abort();
  }, [query]);

  const runSearch = (q) => {
    setDraft(q);
    setParams(q.trim() ? { q: q.trim() } : {});
  };

  const searching = query.trim().length >= 2;
  const loading = searching && result.query !== query;
  // most results from one series? offer its series page
  const topSeries = mostCommonSeries(result.items);

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={styles.searchHead}>
        <h1 className={styles.title}>Price check</h1>
        <p className={styles.sub}>
          Find a volume, then see what US stores charge for it.
        </p>

        <form
          className={styles.searchForm}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(draft);
          }}
        >
          <label className={styles.searchBox}>
            <SearchIcon />
            <span className="sr-only">Series, title, author or ISBN</span>
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Series, title, author or ISBN"
              minLength={2}
              maxLength={100}
              autoFocus={!query}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-lg">
            Search
          </button>
        </form>

        {!searching && (
          <p className={styles.quick}>
            <span>Try</span>
            {QUICK_PICKS.map((pick) => (
              <button key={pick} type="button" onClick={() => runSearch(pick)}>
                {pick}
              </button>
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
          <p className={styles.emptyTitle}>Couldn't search right now.</p>
          <p>{result.error}</p>
        </div>
      )}

      {!loading && searching && !result.error && result.items.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No English volumes found.</p>
          <p>
            Try the series name on its own, or paste the ISBN from the back
            cover.
          </p>
        </div>
      )}

      {!loading && searching && result.items.length > 0 && (
        <>
          {topSeries && (
            <NavLink
              to={seriesPath(topSeries)}
              className={styles.seriesLink}
              viewTransition
            >
              See the whole {topSeries} series →
            </NavLink>
          )}
          <p className={styles.count} aria-live="polite">
            {result.items.length} volume{result.items.length > 1 ? "s" : ""} for
            “{query}”
          </p>
          <ul className={styles.grid}>
            {result.items.map((book) => (
              <li key={book.isbn13}>
                <VolumeCard {...book} subtitle={book.authors} />
              </li>
            ))}
          </ul>
        </>
      )}
      {!searching && <Highlights />}
    </div>
  );
}

function mostCommonSeries(items) {
  const counts = new Map();
  for (const book of items) {
    if (book.volume == null) continue;
    const name = seriesName(book.title);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const [name, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return count >= 2 ? name : null;
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
                <NavLink
                  to={seriesPath(s.name)}
                  className={styles.card}
                  viewTransition
                >
                  <span className={styles.cover}>
                    <span className={styles.coverFallback} aria-hidden>
                      ?
                    </span>
                    {s.coverUrl && (
                      <img src={s.coverUrl} alt="" loading="lazy" />
                    )}
                  </span>
                  <span className={styles.cardTitle}>{s.name}</span>
                  {s.score != null && (
                    <span className={styles.cardMeta}>Score {s.score}</span>
                  )}
                </NavLink>
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

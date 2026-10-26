import { useEffect, useState } from "react";
import { NavLink, useSearchParams } from "react-router";
import { SearchIcon } from "../../components/icons/Icons";
import { coverSrc, hideBrokenCover, searchVolumes } from "../../lib/prices";
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
          <p className={styles.count} aria-live="polite">
            {result.items.length} volume{result.items.length > 1 ? "s" : ""} for
            “{query}”
          </p>
          <ul className={styles.grid}>
            {result.items.map((book) => (
              <li key={book.isbn13}>
                <NavLink
                  to={`/prices/${book.isbn13}`}
                  className={styles.card}
                  viewTransition
                >
                  <span className={styles.cover}>
                    <span className={styles.coverFallback} aria-hidden>
                      {book.volume ?? "?"}
                    </span>
                    <img
                      src={coverSrc(book.coverUrl)}
                      alt=""
                      loading="lazy"
                      onError={hideBrokenCover}
                    />
                    {book.volume !== null && (
                      <span className={styles.vol}>Vol. {book.volume}</span>
                    )}
                  </span>
                  <span className={styles.cardTitle}>{book.title}</span>
                  {book.authors && (
                    <span className={styles.cardMeta}>{book.authors}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

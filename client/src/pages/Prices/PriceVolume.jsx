import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import {
  coverSrc,
  formatCents,
  getVolume,
  hideBrokenCover,
  seriesTitle,
  timeAgo,
} from "../../lib/prices";
import styles from "./Prices.module.css";

const CONDITION = { new: "New", used: "Used" };

export default function PriceVolume() {
  const { isbn } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ isbn: null, data: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    getVolume(isbn, controller.signal)
      .then((data) => setState({ isbn, data, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError") {
          setState({ isbn, data: null, error: e.message });
        }
      });
    return () => controller.abort();
  }, [isbn]);

  // Impact (Walmart affiliate) rewrites links once when its script loads,
  // before this page has drawn them, so ask it again once they exist
  const loaded = state.isbn === isbn && Boolean(state.data);
  useEffect(() => {
    if (loaded) window.impactStat?.("transformLinks");
  }, [loaded, isbn]);

  if (state.isbn !== isbn) return <VolumeSkeleton />;

  if (state.error) {
    return (
      <div className={styles.empty} role="alert">
        <p className={styles.emptyTitle}>Couldn't open this volume.</p>
        <p>{state.error}</p>
        <NavLink to="/prices" className="btn btn-secondary" viewTransition>
          Back to price check
        </NavLink>
      </div>
    );
  }

  const { book, offers, stats, checkedAt, liveSources, storeLinks } =
    state.data;
  // the headline price is the cheapest new print copy, what most people buy
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print",
  );

  return (
    <div className="fade-in">
      {/* go back to the results you came from; a shared link has none */}
      {window.history.state?.idx > 0 ? (
        <button
          type="button"
          className={styles.backLink}
          onClick={() => navigate(-1)}
        >
          ← back to results
        </button>
      ) : (
        <NavLink to="/prices" className={styles.backLink} viewTransition>
          ← price check
        </NavLink>
      )}

      <article className={styles.volume}>
        <figure className={styles.volumeCover}>
          <span className={styles.coverFallback} aria-hidden>
            {book.title.match(/\bvol(?:ume)?\.?\s*(\d+)/i)?.[1] ?? "?"}
          </span>
          {book.coverUrl && (
            <img
              src={coverSrc(book.coverUrl)}
              alt={book.title}
              onError={hideBrokenCover}
            />
          )}
        </figure>

        <header className={styles.volumeHead}>
          <h1 className={styles.volumeTitle}>{book.title}</h1>
          <p className={styles.volumeMeta}>
            {[book.authors, book.publisher, book.year]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className={styles.isbn}>ISBN {book.isbn13}</p>
          {best && (
            <p className={styles.bestLine}>
              New from <strong>{formatCents(best.priceCents)}</strong> at{" "}
              {best.store}
            </p>
          )}
        </header>

        <div className={styles.volumeBody}>
          <section aria-labelledby="offers-title">
            <div className={styles.sectionHead}>
              <h2 id="offers-title" className={styles.sectionTitle}>
                Live prices
              </h2>
              {checkedAt && (
                <span className={styles.checked}>
                  Checked {timeAgo(checkedAt)}
                </span>
              )}
            </div>

            {offers.length > 0 ? (
              <ul className={styles.offers}>
                {offers.map((o) => (
                  <li
                    key={`${o.store}-${o.format}-${o.condition}`}
                    className={o === best ? styles.bestOffer : ""}
                  >
                    <span className={styles.offerStore}>
                      <span>
                        {o.store}
                        {o === best && (
                          <span className={styles.bestTag}>Best new</span>
                        )}
                      </span>
                      <span className={styles.offerTags}>
                        {CONDITION[o.condition] ?? o.condition}
                        {o.format === "ebook" && " · ebook"}
                        {!o.inStock && " · out of stock"}
                      </span>
                    </span>
                    <span className={styles.offerPrice}>
                      {formatCents(o.priceCents)}
                    </span>
                    {o.url ? (
                      <a href={o.url} target="_blank" rel="noreferrer">
                        Go to store
                      </a>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.note}>
                {liveSources.length
                  ? `None of the stores we check (${liveSources.join(", ")}) have this one right now.`
                  : "Live prices aren't switched on yet. Check the stores below directly for now."}
              </p>
            )}
          </section>

          {stats && (
            <section aria-labelledby="history-title">
              <h2 id="history-title" className={styles.sectionTitle}>
                Price history
              </h2>
              <dl className={styles.stats}>
                <div>
                  <dt>All-time low</dt>
                  <dd>{formatCents(stats.lowCents)}</dd>
                </div>
                <div>
                  <dt>All-time high</dt>
                  <dd>{formatCents(stats.highCents)}</dd>
                </div>
                <div>
                  <dt>Average</dt>
                  <dd>{formatCents(stats.avgCents)}</dd>
                </div>
              </dl>
              <p className={styles.checked}>
                New print copies, {stats.samples} price
                {stats.samples > 1 ? "s" : ""} seen since{" "}
                {new Date(stats.since).toLocaleDateString()}
              </p>
            </section>
          )}

          <section aria-labelledby="links-title">
            <h2 id="links-title" className={styles.sectionTitle}>
              Check price at
            </h2>
            <ul className={styles.storeLinks}>
              {storeLinks.map((s) => (
                <li key={s.store}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.store}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {storeLinks.some((s) => s.affiliate) && (
            <p className={styles.disclosure}>
              Some store links are affiliate links: if you buy through them we
              may earn a small commission, at no extra cost to you.
              {storeLinks.some((s) => s.store === "Amazon" && s.affiliate) &&
                " As an Amazon Associate I earn from qualifying purchases."}
            </p>
          )}

          <div className={styles.volumeActions}>
            <NavLink
              to={`/add?${new URLSearchParams({ title: seriesTitle(book.title) })}`}
              className="btn btn-primary"
              viewTransition
            >
              Add to my shelf
            </NavLink>
            <NavLink
              to={`/prices?${new URLSearchParams({ q: seriesTitle(book.title) })}`}
              className="btn btn-ghost"
              viewTransition
            >
              Other volumes
            </NavLink>
          </div>
        </div>
      </article>
    </div>
  );
}

function VolumeSkeleton() {
  return (
    <div className={styles.volume} aria-busy="true" aria-label="Loading">
      <div
        className={`skeleton ${styles.volumeCover} ${styles.coverSkeleton}`}
      />
      <div className={styles.volumeHead}>
        <div className="skeleton" style={{ width: "70%", height: 44 }} />
        <div className="skeleton" style={{ width: "40%", height: 20 }} />
      </div>
      <div className={styles.volumeBody}>
        <div className="skeleton" style={{ width: "100%", height: 160 }} />
      </div>
    </div>
  );
}

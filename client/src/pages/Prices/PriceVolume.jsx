import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router";
import {
  coverSrc,
  formatCents,
  getVolume,
  hideBrokenCover,
  seriesPath,
  seriesTitle,
  timeAgo,
} from "../../lib/prices";
import SeriesFacts from "./SeriesFacts";
import VolumeCard from "./VolumeCard";
import styles from "./Prices.module.css";
import Mascot from "../../components/mascot/Mascot";

// longer price lists start collapsed, like manga.london's "Show N more"
const VISIBLE_OFFERS = 5;
const SIBLINGS_SHOWN = 12;

const shortDate = (d) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const CONDITION = { new: "New", used: "Used", marketplace: "Marketplace" };

export default function PriceVolume() {
  const { isbn } = useParams();
  const [showAll, setShowAll] = useState({ isbn, open: false });
  const offersOpen = showAll.isbn === isbn && showAll.open;
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
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="panic" />
        </span>
        <p className={styles.emptyTitle}>Couldn't open this volume.</p>
        <p>{state.error}</p>
        <NavLink to="/" className="btn btn-secondary" viewTransition>
          Back to price check
        </NavLink>
      </div>
    );
  }

  const {
    book,
    series,
    volume,
    siblings,
    offers,
    stats,
    checkedAt,
    liveSources,
    storeLinks,
  } = state.data;
  const seriesLabel = series.info?.name ?? series.name;
  const shownOffers = offersOpen ? offers : offers.slice(0, VISIBLE_OFFERS);
  // the next volumes first, then the ones before
  const nearby = [
    ...siblings.filter((v) => volume == null || v.volume > volume),
    ...siblings.filter((v) => volume != null && v.volume < volume).reverse(),
  ].slice(0, SIBLINGS_SHOWN);
  // the headline price is the cheapest new print copy, what most people buy
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print",
  );

  return (
    <div className="fade-in">
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <NavLink to="/" viewTransition>
          Price check
        </NavLink>
        <span aria-hidden>/</span>
        <NavLink to={seriesPath(series.name)} viewTransition>
          {seriesLabel}
        </NavLink>
        <span aria-hidden>/</span>
        <span aria-current="page">
          {volume != null ? `Vol. ${volume}` : book.title}
        </span>
      </nav>

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
          <p className={styles.isbn}>
            {volume != null && (
              <span className={styles.tag}>Vol. {volume}</span>
            )}
            <span className={styles.tag}>ISBN-13 {book.isbn13}</span>
          </p>
          <p className={styles.partOf}>
            Part of{" "}
            <NavLink to={seriesPath(series.name)} viewTransition>
              {seriesLabel}
            </NavLink>
          </p>
          {best && (
            <p className={styles.bestLine}>
              New from <strong>{formatCents(best.priceCents)}</strong> at{" "}
              {best.store}
            </p>
          )}
        </header>

        <div className={styles.volumeBody}>
          {series.info && <SeriesFacts info={series.info} />}

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
                {shownOffers.map((o) => (
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
                {offers.length > VISIBLE_OFFERS && (
                  <li className={styles.moreRow}>
                    <button
                      type="button"
                      className={styles.textBtn}
                      aria-expanded={offersOpen}
                      onClick={() => setShowAll({ isbn, open: !offersOpen })}
                    >
                      {offersOpen
                        ? "Show fewer"
                        : `Show ${offers.length - VISIBLE_OFFERS} more`}
                    </button>
                  </li>
                )}
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
                  <dd className={styles.statDate}>{shortDate(stats.lowAt)}</dd>
                </div>
                <div>
                  <dt>All-time high</dt>
                  <dd>{formatCents(stats.highCents)}</dd>
                  <dd className={styles.statDate}>{shortDate(stats.highAt)}</dd>
                </div>
                <div>
                  <dt>Average</dt>
                  <dd>{formatCents(stats.avgCents)}</dd>
                </div>
                <div>
                  <dt>Median</dt>
                  <dd>{formatCents(stats.medianCents)}</dd>
                </div>
              </dl>
              <p className={styles.checked}>
                Cheapest new print copy across {stats.samples} check
                {stats.samples > 1 ? "s" : ""}, {shortDate(stats.since)}
                {stats.samples > 1 && ` to ${shortDate(stats.lastSeen)}`} ·{" "}
                {stats.changes} price change{stats.changes === 1 ? "" : "s"}
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
              to={seriesPath(series.name)}
              className="btn btn-ghost"
              viewTransition
            >
              All volumes
            </NavLink>
          </div>
        </div>
      </article>

      {nearby.length > 0 && (
        <section className={styles.siblings} aria-labelledby="siblings-title">
          <div className={styles.sectionHead}>
            <h2 id="siblings-title" className={styles.sectionTitle}>
              From the same series
            </h2>
            <NavLink
              to={seriesPath(series.name)}
              className={styles.textBtn}
              viewTransition
            >
              See all {siblings.length + 1}
            </NavLink>
          </div>
          <ul className={styles.row}>
            {nearby.map((v) => (
              <li key={v.isbn13}>
                <VolumeCard
                  {...v}
                  title={`Vol. ${v.volume}`}
                  priceCents={v.knownPriceCents}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
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

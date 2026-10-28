import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import {
  coverSrc,
  formatCents,
  getVolume,
  hideBrokenCover,
  volumePath,
  seriesPath,
  seriesTitle,
  timeAgo,
} from "../../lib/prices";
import SeriesFacts from "./SeriesFacts";
import VolumeCard, { CoverFallback } from "./VolumeCard";
import { pricesStyles as styles } from "./styles";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { usePageMeta } from "../../lib/seo";
import { volumeMeta } from "./pageMeta";
import ShelfAction from "./ShelfAction";
import type { Offer, VolumePrices } from "../../lib/types";

// the Impact script (index.html) that turns Walmart links into affiliate links
declare global {
  interface Window {
    impactStat?: (command: string) => void;
  }
}

// longer price lists start collapsed, like manga.london's "Show N more"
const VISIBLE_OFFERS = 5;
const SIBLINGS_SHOWN = 12;

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const CONDITION: Record<string, string> = {
  new: "New",
  used: "Used",
  marketplace: "Marketplace",
};

// awards go to the cheapest copies; type labels say what kind of copy it is
const AWARDS = {
  lowest: { label: "Lowest overall", className: styles.awardLowest },
  newLow: { label: "Cheapest new", className: styles.awardNew },
  marketLow: { label: "Cheapest marketplace", className: styles.awardMarket },
};
const TYPE_LABEL = {
  newPrint: { label: "New print", className: styles.labelNew },
  used: { label: "Used", className: styles.labelMarket },
  marketplace: { label: "Marketplace", className: styles.labelMarket },
  ebook: { label: "Ebook", className: styles.labelEbook },
};
const typeOf = (o: Offer) =>
  o.format === "ebook"
    ? TYPE_LABEL.ebook
    : o.condition === "new"
      ? TYPE_LABEL.newPrint
      : o.condition === "used"
        ? TYPE_LABEL.used
        : TYPE_LABEL.marketplace;

export default function PriceVolume() {
  // the route always has an :isbn
  const isbn = useParams().isbn!;
  const [showAll, setShowAll] = useState({ isbn, open: false });
  const offersOpen = showAll.isbn === isbn && showAll.open;
  // which ISBN the data is for, so a stale answer never shows
  const [state, setState] = useState<{
    isbn: string | null;
    data: VolumePrices | null;
    error: string;
  }>({ isbn: null, data: null, error: "" });
  const loadedBook = state.isbn === isbn ? state.data?.book : null;
  usePageMeta(
    state.isbn === isbn && state.data ? volumeMeta(state.data) : null,
  );

  // an ISBN-only or outdated link: show the address with the title in it,
  // without loading the page again
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!loadedBook) return;
    const path = volumePath(loadedBook.isbn13, loadedBook.title);
    if (pathname !== path) navigate(path + search, { replace: true });
  }, [loadedBook, pathname, search, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    getVolume(isbn, controller.signal)
      .then((data) => setState({ isbn, data, error: "" }))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setState({ isbn, data: null, error: (e as Error).message });
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

  if (state.error || !state.data) {
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
    ...siblings.filter((v) => volume == null || (v.volume ?? 0) > volume),
    ...siblings.filter((v) => volume != null && (v.volume ?? 0) < volume).reverse(),
  ].slice(0, SIBLINGS_SHOWN);
  // the headline price is the cheapest new print copy, what most people buy
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print",
  );
  // the awards go to copies you can buy now. Offers are sorted cheapest
  // first, so each is the first match. The lowest overall (ebooks included)
  // always shows what kind of copy it is ("Lowest overall" + "New print"),
  // which also says it's the cheapest of its kind, so it never doubles up
  // with "Cheapest new" or "Cheapest marketplace". Ebooks always say so
  const inStock = offers.filter((o) => o.inStock);
  const lowest = inStock[0];
  const newLow = inStock.find((o) => o.format === "print" && o.condition === "new");
  const marketLow = inStock.find((o) => o.format === "print" && o.condition !== "new");
  const stampsOf = (o: Offer) =>
    o === lowest
      ? [AWARDS.lowest, typeOf(o)]
      : [
          ...(o === newLow ? [AWARDS.newLow] : []),
          ...(o === marketLow ? [AWARDS.marketLow] : []),
          ...(o.format === "ebook" ? [TYPE_LABEL.ebook] : []),
        ];

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
          <CoverFallback
            number={volume}
            seriesCoverUrl={series.info?.coverUrl}
          />
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
              <div className={styles.live_info}>
                <h2 id="offers-title" className={styles.sectionTitle}>
                  Live prices{" "}
                </h2>
                {checkedAt && (
                  <span className={styles.checked}>{timeAgo(checkedAt)}</span>
                )}
              </div>
              <p className={styles.sectionNote}>
                May exclude direct retailers like Amazon or B&N, which could be
                cheaper. Check store links below.
              </p>
            </div>

            {offers.length > 0 ? (
              <ul className={styles.offers}>
                {shownOffers.map((o) => (
                  <li
                    key={`${o.store}-${o.format}-${o.condition}`}
                    className={o === lowest ? styles.lowestOffer : ""}
                  >
                    <span className={styles.offerStore}>
                      <span className={styles.offerName}>
                        {o.store}
                        {stampsOf(o).map(({ label, className }) => (
                          <span key={label} className={className}>
                            {label}
                          </span>
                        ))}
                      </span>
                      <span className={styles.offerTags}>
                        {CONDITION[o.condition] ?? o.condition}
                        {!o.inStock && " · out of stock"}
                      </span>
                    </span>
                    <span className={styles.offerPrice}>
                      {formatCents(o.priceCents)}
                    </span>
                    {o.url ? (
                      <a href={o.url} target="_blank" rel={linkRel(o)}>
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
                {liveSources.length ? (
                  <>
                    No live prices for this one right now. It's often still in
                    stock, so{" "}
                    <a href="#links-title">check the store links below</a> for
                    Amazon, Barnes &amp; Noble and more.
                  </>
                ) : (
                  <>
                    Live prices aren't switched on yet.{" "}
                    <a href="#links-title">Check the store links below</a> for
                    now.
                  </>
                )}
              </p>
            )}
          </section>

          <section aria-labelledby="links-title">
            <h2 id="links-title" className={styles.sectionTitle}>
              Check price at
            </h2>
            <ul className={styles.storeLinks}>
              {storeLinks.map((s) => (
                <li key={s.store}>
                  <a href={s.url} target="_blank" rel={linkRel(s)}>
                    {s.store}
                  </a>
                </li>
              ))}
            </ul>
          </section>
          {storeLinks.some((s) => s.affiliate) && (
            <p className={styles.disclosure}>
              *Some store links are affiliate links which will be used to keep
              the server running.*
            </p>
          )}

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
                Lowest new print price at the stores we check, across{" "}
                {stats.samples} check
                {stats.samples > 1 ? "s" : ""}, {shortDate(stats.since)}
                {stats.samples > 1 && ` to ${shortDate(stats.lastSeen)}`} ·{" "}
                {stats.changes} price change{stats.changes === 1 ? "" : "s"}
              </p>
            </section>
          )}

          <div className={styles.volumeActions}>
            <ShelfAction
              series={seriesLabel}
              title={seriesTitle(book.title)}
              volume={volume}
            />

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
                  fullTitle={v.title}
                  seriesCoverUrl={series.info?.coverUrl}
                  priceCents={v.knownPriceCents}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* wording required by the Amazon Associates agreement, kept on the
          page that carries the store links */}
      {storeLinks.some((s) => s.store === "Amazon" && s.affiliate) && (
        <p className={styles.amazonDisclosure}>
          As an Amazon Associate I earn from qualifying purchases.
        </p>
      )}
    </div>
  );
}

// affiliate links are marked as paid links, as search engines ask
const linkRel = (link: { affiliate: boolean }) =>
  link.affiliate ? "sponsored noreferrer" : "noreferrer";

function VolumeSkeleton() {
  return (
    <div className={styles.volume} aria-busy="true" aria-label="Loading">
      <SlowLoadQuote />
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

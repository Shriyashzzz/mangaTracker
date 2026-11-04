import CanadaPrices from "./canada/CanadaPrices";
import CountrySwitch from "./canada/CountrySwitch";
import { useCountry } from "../../lib/prefs";
import { useEffect, useState } from "react";
import { noteStoreClick } from "../../lib/support";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import {
  coverSrc,
  formatCents,
  getVolume,
  hideBrokenCover,
  volumePath,
  seriesPath,
  seriesTitle,
  novelParts,
  timeAgo,
} from "../../lib/prices";
import SeriesFacts from "./SeriesFacts";
import BackToNew from "./BackToNew";
import VolumeCard, { CoverFallback } from "./VolumeCard";
import { pricesStyles as styles } from "./styles";
import OfferList from "./OfferList";
import { TYPE_LABEL, linkRel } from "./offerLabels";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { stayInTrip, useFromShelf } from "../../lib/fromShelf";
import { readLocal } from "../../lib/prefs";
import { usePageMeta } from "../../lib/seo";
import { volumeMeta } from "./pageMeta";
import ShelfAction from "./ShelfAction";
import type { VolumePrices } from "../../lib/types";

// the Impact script (index.html) that turns Walmart links into affiliate links
declare global {
  interface Window {
    impactStat?: (command: string) => void;
  }
}

// longer price lists start collapsed, like manga.london's "Show N more"
const SIBLINGS_SHOWN = 12;

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// "Oct 26", with the year only when it isn't this one
const dayDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
};

// the history's rows, labelled like the offers' type labels
const KIND_LABEL = {
  new: TYPE_LABEL.newPrint,
  marketplace: { label: "Used & marketplace", className: styles.labelMarket },
  ebook: TYPE_LABEL.ebook,
};

export default function PriceVolume() {
  // US or Canada: switched right on the page, by anyone
  const country = useCountry();
  // the route always has an :isbn
  const isbn = useParams().isbn!;
  const [attempt, setAttempt] = useState(0);
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
  const { pathname, search, state: linkState } = useLocation();
  const fromShelf = useFromShelf();
  useEffect(() => {
    if (!loadedBook) return;
    const path = volumePath(loadedBook.isbn13, loadedBook.title);
    if (pathname !== path)
      navigate(path + search, { replace: true, state: linkState });
  }, [loadedBook, pathname, search, navigate, linkState]);

  useEffect(() => {
    const controller = new AbortController();
    getVolume(isbn, controller.signal, country === "ca")
      .then((data) => setState({ isbn, data, error: "" }))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setState({ isbn, data: null, error: (e as Error).message });
        }
      });
    return () => controller.abort();
  }, [isbn, attempt, country]);

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
        <p>Check your connection and try again in a moment.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setState({ isbn: null, data: null, error: "" });
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
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
    offers: allOffers,
    history: allHistory,
    checkedAt,
    liveSources,
    storeLinks,
  } = state.data;
  const seriesLabel = series.info?.name ?? series.name;
  // a light novel's are named "Overlord Light Novel, Vol. 3": shown as the
  // series' own name, tagged
  const shownSeries = novelParts(seriesLabel).title;
  const shownBook = novelParts(book.title);
  // set in settings: they only want physical copies
  const hideEbooks = readLocal("hideEbooks") === "yes";
  const inCanada = country === "ca";
  const offers = hideEbooks
    ? allOffers.filter((o) => o.format !== "ebook")
    : allOffers;
  const hiddenEbooks = allOffers.length - offers.length;
  const kinds = (allHistory?.kinds ?? []).filter(
    (k) => !hideEbooks || k.kind !== "ebook",
  );
  const history = allHistory && kinds.length ? { ...allHistory, kinds } : null;
  // the summary is for a physical copy, like the rest of the page
  const printKinds = kinds.filter((k) => k.kind !== "ebook");
  const lowestInHistory = Math.min(
    ...(printKinds.length ? printKinds : kinds).map((k) => k.lowCents),
  );
  // the next volumes first, then the ones before
  const nearby = [
    ...siblings.filter((v) => volume == null || (v.volume ?? 0) > volume),
    ...siblings
      .filter((v) => volume != null && (v.volume ?? 0) < volume)
      .reverse(),
  ].slice(0, SIBLINGS_SHOWN);
  // the stores with no row in the price list; the others would just repeat
  const hasOffer = (store: string) =>
    offers.some((o) => {
      const a = o.store.toLowerCase();
      const b = store.toLowerCase();
      return a.includes(b) || b.includes(a);
    });
  // eBay stays either way: a row there is one seller, and many more may have it
  // and it goes first
  const otherStores = [
    ...storeLinks.filter((s) => s.store === "eBay"),
    ...storeLinks.filter((s) => s.store !== "eBay" && !hasOffer(s.store)),
  ];
  // the headline price is the cheapest new print copy, what most people buy
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print",
  );

  return (
    <div className="fade-in">
      {fromShelf && <BackToNew />}
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <NavLink to="/" className="tap" viewTransition>
          Price check
        </NavLink>
        <span aria-hidden>/</span>
        <NavLink
          to={seriesPath(series.name)}
          className="tap"
          viewTransition
          {...stayInTrip(fromShelf)}
        >
          {shownSeries}
        </NavLink>
        <span aria-hidden>/</span>
        <span aria-current="page">
          {volume != null ? `Vol. ${volume}` : shownBook.title}
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
          <h1 className={styles.volumeTitle}>{shownBook.title}</h1>
          <p className={styles.volumeMeta}>
            {[book.authors, book.publisher, book.year]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className={styles.isbn}>
            {volume != null && (
              <span className={styles.tag}>Vol. {volume}</span>
            )}
            {shownBook.lightNovel && (
              <span className={styles.tag}>Light novel</span>
            )}
            <span className={styles.tag}>ISBN-13 {book.isbn13}</span>
          </p>
          <p className={styles.partOf}>
            Part of{" "}
            <NavLink
              to={seriesPath(series.name)}
              viewTransition
              {...stayInTrip(fromShelf)}
            >
              {shownSeries}
            </NavLink>
          </p>
          {/* US numbers: not shown when they're looking at Canadian prices */}
          {best && !inCanada && (
            <p className={styles.bestLine}>
              New from <strong>{formatCents(best.priceCents)}</strong> at{" "}
              {best.store}
            </p>
          )}
          {/* where it's seen before anyone heads off to a store */}
          <div className={styles.volumeActions}>
            <ShelfAction
              series={seriesLabel}
              title={seriesTitle(book.title)}
              volume={volume}
            />
          </div>
        </header>

        <div className={styles.volumeBody}>
          {/* one country's prices at a time */}
          {inCanada && <CanadaPrices isbn={book.isbn13} />}
          {!inCanada && (
            <section aria-labelledby="offers-title">
              <div className={styles.sectionHeadRow}>
                <h2 id="offers-title" className={styles.sectionTitle}>
                  Prices
                </h2>
                <span className="flex items-center gap-3">
                  {checkedAt && (
                    <span className={styles.checked}>
                      checked {timeAgo(checkedAt)}
                    </span>
                  )}
                  <CountrySwitch />
                </span>
              </div>

              {offers.length > 0 ? (
                <OfferList
                  key={isbn}
                  offers={offers}
                  formatPrice={formatCents}
                  tourTarget="offers"
                />
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

              {hiddenEbooks > 0 && (
                <p className={styles.checked}>
                  {hiddenEbooks} ebook {hiddenEbooks === 1 ? "price" : "prices"}{" "}
                  hidden.{" "}
                  <NavLink to="/settings/prices" viewTransition>
                    Change in settings
                  </NavLink>
                </p>
              )}

              {otherStores.length > 0 && (
                <div className={styles.otherStores}>
                  <h3 id="links-title" className={styles.otherStoresTitle}>
                    {offers.length > 0
                      ? "Also worth checking, they could be cheaper:"
                      : "Check price at:"}
                  </h3>
                  <ul className={styles.storeLinks}>
                    {otherStores.map((s) => (
                      <li key={s.store}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel={linkRel(s)}
                          onClick={noteStoreClick}
                          onAuxClick={noteStoreClick}
                          aria-label={`${s.store}. Opens the store in a new tab`}
                        >
                          {s.store}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {storeLinks.some((s) => s.affiliate) && (
                <p className={styles.disclosure}>
                  Some store links are affiliate links which will be used to
                  keep the server running.
                </p>
              )}
            </section>
          )}

          {history && !inCanada && (
            <details className={styles.historyFold}>
              <summary className={styles.historySummary}>
                <h2 className={styles.sectionTitle}>Price history</h2>
                <span className={styles.checked}>
                  lowest {formatCents(lowestInHistory)}
                </span>
                <ChevronDownIcon />
              </summary>
              <div className={styles.history}>
                {history.kinds.map((k) => (
                  <div key={k.kind} className={styles.historyRow}>
                    <span className={KIND_LABEL[k.kind].className}>
                      {KIND_LABEL[k.kind].label}
                    </span>
                    <dl className={styles.historyStats}>
                      <div>
                        <dt>Lowest</dt>
                        <dd>{formatCents(k.lowCents)}</dd>
                        <dd className={styles.statDate}>{dayDate(k.lowAt)}</dd>
                        <dd className={styles.statStore} title={k.lowStore}>
                          {k.lowStore}
                        </dd>
                      </div>
                      <div>
                        <dt>Highest</dt>
                        <dd>{formatCents(k.highCents)}</dd>
                        <dd className={styles.statDate}>{dayDate(k.highAt)}</dd>
                        <dd className={styles.statStore} title={k.highStore}>
                          {k.highStore}
                        </dd>
                      </div>
                      <div>
                        <dt>Median</dt>
                        <dd>{formatCents(k.medianCents)}</dd>
                        <dd className={styles.statDate}>
                          {k.listings} price{k.listings === 1 ? "" : "s"} seen
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
              <p className={styles.checked}>
                Every in-stock price at the stores we check, across{" "}
                {history.checks} check{history.checks === 1 ? "" : "s"},{" "}
                {shortDate(history.since)}
                {history.checks > 1 && ` to ${shortDate(history.lastSeen)}`}
              </p>
            </details>
          )}

          {series.info && (
            <section aria-labelledby="series-about">
              <h2 id="series-about" className={styles.sectionTitle}>
                About this series
              </h2>
              <SeriesFacts info={series.info} />
            </section>
          )}
        </div>
      </article>

      {nearby.length > 0 && (
        <section className={styles.siblings} aria-labelledby="siblings-title">
          <div className={styles.sectionHeadRow}>
            <h2 id="siblings-title" className={styles.sectionTitle}>
              From the same series
            </h2>
            <NavLink
              to={seriesPath(series.name)}
              className={styles.textBtn}
              viewTransition
              {...stayInTrip(fromShelf)}
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

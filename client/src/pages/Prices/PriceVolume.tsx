import CanadaPrices from "./canada/CanadaPrices";
import CountrySwitch from "./canada/CountrySwitch";
import { useBoxSetsShown, useCountry } from "../../lib/prefs";
import BoxSetToggle from "./BoxSetToggle";
import { useEffect, useState } from "react";
import DealsStrip from "../../components/deals/DealsStrip";
import { noteStoreClick } from "../../lib/support";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import {
  coverSrc,
  formatCents,
  getVolume,
  hideBrokenCover,
  hidePlaceholderCover,
  volumePath,
  seriesCanonicalPath,
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
import { knownStoreLow } from "./offerLabels";
import { TYPE_LABEL, linkRel } from "./offerLabels";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { stayInTrip, useFromShelf } from "../../lib/fromShelf";
import { readLocal } from "../../lib/prefs";
import { usePageMeta } from "../../lib/seo";
import { volumeMeta } from "./pageMeta";
import ShelfAction from "./ShelfAction";
import { isCollection, type VolumePrices } from "../../lib/types";

// the Impact script (index.html) that turns Walmart links into affiliate links
declare global {
  interface Window {
    impactStat?: (command: string) => void;
  }
}

// longer price lists start collapsed, like manga.london's "Show N more"
const SIBLINGS_SHOWN = 12;

// a volume not out yet gets a button for each of these (the affiliate
// stores), the first the main one; the other stores are links under them
const PREORDER_STORES = ["Amazon", "Bookshop.org", "eBay"];

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

// "Mar 30, 2027" (or "Mar 2027" when only the month is known)
const releaseDay = (published: string) => {
  const [y, m, d] = published.split("-").map(Number);
  return new Date(y!, (m || 1) - 1, d || 1).toLocaleDateString("en-US", {
    month: "short",
    ...(d ? { day: "numeric" } : {}),
    year: "numeric",
  });
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
  const { pathname, search, hash, state: linkState } = useLocation();
  const fromShelf = useFromShelf();
  useEffect(() => {
    if (!loadedBook) return;
    const path = volumePath(loadedBook.isbn13, loadedBook.title);
    if (pathname !== path)
      navigate(path + search + hash, { replace: true, state: linkState });
  }, [loadedBook, pathname, search, hash, navigate, linkState]);

  // which volume is being checked live right now, after its stored prices
  const [refreshing, setRefreshing] = useState<string | null>(null);
  // box sets holding this volume: listed unless turned off
  const boxSetsShown = useBoxSetsShown();

  // the stored prices first, straight away: they need no Turnstile, so the
  // page (and what search engines see) never waits on it. Then a live check,
  // only when it would look again; until it answers, the stored ones stay
  useEffect(() => {
    const controller = new AbortController();
    getVolume(isbn, controller.signal, true)
      .then((data) => {
        setState({ isbn, data, error: "" });
        // Canadian prices are their own; these US ones are only for show
        if (country === "ca" || !data.refreshable) return;
        setRefreshing(isbn);
        return getVolume(isbn, controller.signal, false)
          .then((fresh) => setState({ isbn, data: fresh, error: "" }))
          .catch(() => {
            // a failed or refused live check leaves the stored prices
          })
          .finally(() => {
            if (!controller.signal.aborted) setRefreshing(null);
          });
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setState({ isbn, data: null, error: (e as Error).message });
        }
      });
    return () => {
      controller.abort();
      setRefreshing(null);
    };
  }, [isbn, attempt, country]);

  // Impact (Walmart affiliate) rewrites links once when its script loads,
  // before this page has drawn them, so ask it again once they exist
  const loaded = state.isbn === isbn && Boolean(state.data);
  useEffect(() => {
    if (loaded) window.impactStat?.("transformLinks");
  }, [loaded, isbn]);

  // linked from the release calendar (#preorder): once the page has loaded,
  // straight to where to preorder it
  // (the US box or the Canadian one, whichever is shown)
  useEffect(() => {
    if (loaded && hash === "#preorder")
      document.getElementById("preorder")?.scrollIntoView({ block: "center" });
  }, [loaded, hash]);

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
    inBook,
    preorder,
    siblings,
    offers: allOffers,
    history: allHistory,
    checkedAt,
    liveSources,
    storeLinks,
  } = state.data;
  // the series page: its clean address when AniList knows the series (the
  // address search engines know it by), else by name
  const seriesLink = series.info
    ? seriesCanonicalPath(series.info.name)
    : seriesPath(series.name);
  const seriesLabel = series.info?.name ?? series.name;
  // a light novel's are named "Overlord Light Novel, Vol. 3": shown as the
  // series' own name, tagged
  const shownSeries = novelParts(seriesLabel).title;
  // its heading ("Series, Vol. N" when the stored title has no number)
  const shownBook = novelParts(state.data.heading ?? book.title);
  // set in settings: they only want physical copies
  const hideEbooks = readLocal("hideEbooks") === "yes";
  const inCanada = country === "ca";
  const hiddenEbooks = hideEbooks
    ? allOffers.filter((o) => o.format === "ebook").length
    : 0;
  const boxSets = allOffers.filter(isCollection).length;
  const offers = allOffers.filter(
    (o) =>
      !(hideEbooks && o.format === "ebook") &&
      !(!boxSetsShown && isCollection(o)),
  );
  const kinds = (allHistory?.kinds ?? []).filter(
    (k) => !hideEbooks || k.kind !== "ebook",
  );
  const history = allHistory && kinds.length ? { ...allHistory, kinds } : null;
  // the summary is for a physical copy, like the rest of the page
  const printKinds = kinds.filter((k) => k.kind !== "ebook");
  const lowestInHistory = Math.min(
    ...(printKinds.length ? printKinds : kinds).map((k) => k.lowCents),
  );
  // the next volumes first, then the ones before. A book holding several
  // counts as its last one
  const at = volume ?? inBook?.to ?? null;
  const nearby = [
    ...siblings.filter((v) => at == null || (v.volume ?? 0) > at),
    ...siblings.filter((v) => at != null && (v.volume ?? 0) < at).reverse(),
  ].slice(0, SIBLINGS_SHOWN);
  // a preorder's main buttons, in this order; the other stores are listed
  // under them
  const preorderAt = preorder
    ? PREORDER_STORES.flatMap(
        (name) => storeLinks.find((s) => s.store === name) ?? [],
      )
    : [];
  const isButton = (store: string) => preorderAt.some((s) => s.store === store);
  // the stores with no row in the price list; the others would just repeat.
  // A preorder shows no price list, so then every store is listed
  const hasOffer = (store: string) =>
    !preorder &&
    offers.some((o) => {
      const a = o.store.toLowerCase();
      const b = store.toLowerCase();
      return a.includes(b) || b.includes(a);
    });
  // eBay stays either way: a row there is one seller, and many more may have it
  // and it goes first
  const otherStores = [
    ...storeLinks.filter((s) => s.store === "eBay" && !isButton(s.store)),
    ...storeLinks.filter(
      (s) => s.store !== "eBay" && !hasOffer(s.store) && !isButton(s.store),
    ),
  ];
  // the headline price is the cheapest new print copy, what most people buy
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print",
  );
  // a seller nobody has heard of: the cheapest at a store people know too
  const knownBest = knownStoreLow(offers);

  return (
    <div className="fade-in">
      {fromShelf && <BackToNew />}
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <NavLink to="/" className="tap" viewTransition>
          Price check
        </NavLink>
        <span aria-hidden>/</span>
        <NavLink
          to={seriesLink}
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
      <DealsStrip />

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
              onLoad={hidePlaceholderCover}
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
            {/* the title says the number already: on a phone the room
                goes to the prices, so they show before any scrolling */}
            {volume != null && (
              <span className={`${styles.tag} upto-720:hidden`}>
                Vol. {volume}
              </span>
            )}
            {inBook && (
              <span className={styles.tag}>
                Vols. {inBook.from}–{inBook.to} in one book
              </span>
            )}
            {shownBook.lightNovel && (
              <span className={styles.tag}>Light novel</span>
            )}
            <span className={styles.tag}>ISBN-13 {book.isbn13}</span>
          </p>
          <p className={styles.partOf}>
            Part of{" "}
            <NavLink to={seriesLink} viewTransition {...stayInTrip(fromShelf)}>
              {shownSeries}
            </NavLink>
          </p>
          {/* US numbers: not shown when they're looking at Canadian prices */}
          {best && !inCanada && (
            <p className={styles.bestLine}>
              New from <strong>{formatCents(best.priceCents)}</strong> at{" "}
              {best.store}
              {knownBest && (
                <>
                  , or <strong>{formatCents(knownBest.priceCents)}</strong> at{" "}
                  {knownBest.store}
                </>
              )}
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
          {inCanada && (
            <CanadaPrices
              isbn={book.isbn13}
              preorder={preorder ? releaseDay(preorder) : null}
            />
          )}
          {!inCanada && (
            <section aria-labelledby="offers-title">
              <div className={styles.sectionHeadRow}>
                <h2 id="offers-title" className={styles.sectionTitle}>
                  Prices
                </h2>
                <span className={styles.checkedRow}>
                  {refreshing === isbn ? (
                    <span className={styles.checked} role="status">
                      checking stores…
                    </span>
                  ) : (
                    checkedAt && (
                      <span className={styles.checked}>
                        checked {timeAgo(checkedAt)}
                      </span>
                    )
                  )}
                  <CountrySwitch />
                </span>
              </div>

              {preorder ? (
                // not out yet: no prices to compare, just where to order it
                <div id="preorder" className={styles.preorder}>
                  <p className="m-0">
                    Not out until <b>{releaseDay(preorder)}</b>. Preorder it now
                    and it ships on release day; prices show here once it's out.
                  </p>
                  {preorderAt.length > 0 && (
                    <div className={styles.preorderButtons}>
                      {preorderAt.map((s, i) => (
                        <a
                          key={s.store}
                          href={s.url}
                          target="_blank"
                          rel={linkRel(s)}
                          onClick={noteStoreClick}
                          onAuxClick={noteStoreClick}
                          className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"}`}
                          aria-label={`Preorder on ${s.store}. Opens the store in a new tab`}
                        >
                          {i === 0 ? `Preorder on ${s.store}` : s.store}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : offers.length > 0 ? (
                <OfferList
                  key={isbn}
                  offers={offers}
                  formatPrice={formatCents}
                  tourTarget="offers"
                />
              ) : (
                <p className={styles.note}>
                  {refreshing === isbn ? (
                    // nothing stored yet and the live check still going: not
                    // "no prices" until it answers
                    <>Checking stores for prices…</>
                  ) : liveSources.length ? (
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

              <BoxSetToggle count={boxSets} />

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
                    {preorder
                      ? "Or preorder at:"
                      : offers.length > 0
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
                  Some store links are affiliate links, which help keep the site
                  running at no cost to you.
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
              to={seriesLink}
              className={styles.textBtn}
              viewTransition
              {...stayInTrip(fromShelf)}
            >
              See them all
            </NavLink>
          </div>
          <ul className={styles.row}>
            {nearby.map((v) => (
              <li key={v.isbn13}>
                <VolumeCard
                  {...v}
                  title={
                    v.inBook ? `Book ${v.inBook.book}` : `Vol. ${v.volume}`
                  }
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

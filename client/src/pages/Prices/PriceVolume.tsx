// A volume's price page: the book, the cheapest price and every store's
// offer, where to preorder it when it isn't out, its price history, and the
// volumes around it in its series. Its parts:
//   useVolumeLoad.ts      stored prices first, then a live check
//   volumePageRules.ts    what shows, which stores get a link (pure)
//   VolumePageStates.tsx  loading and not-found
//   OfferList, ShelfAction, BoxSetNote, canada/ (the Canadian prices)
import CanadaPrices from "./canada/CanadaPrices";
import CountrySwitch from "./canada/CountrySwitch";
import { useCountry } from "../../lib/prefs";
import BoxSetNote from "./BoxSetNote";
import { useEffect } from "react";
import DealsStrip from "../../components/deals/DealsStrip";
import { noteStoreClick } from "../../lib/support";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import {
  coverSrc,
  formatCents,
  hideBrokenCover,
  hidePlaceholderCover,
  volumePath,
  seriesCanonicalPath,
  seriesPath,
  seriesTitle,
  novelParts,
  timeAgo,
  olderThanDays,
} from "../../lib/prices";
import SeriesFacts from "./SeriesFacts";
import BackToNew from "./BackToNew";
import VolumeCard, { CoverFallback } from "./VolumeCard";
import { pricesStyles as styles } from "./styles";
import OfferList from "./OfferList";
import { knownStoreLow } from "./offerLabels";
import { TYPE_LABEL, linkRel } from "./offerLabels";
import { stayInTrip, useFromShelf } from "../../lib/fromShelf";
import { readLocal } from "../../lib/prefs";
import { usePageMeta } from "../../lib/seo";
import { volumeMeta } from "./pageMeta";
import ShelfAction from "./ShelfAction";
import { useVolumeLoad } from "./useVolumeLoad";
import { VolumeNotOpened, VolumeSkeleton } from "./VolumePageStates";
import {
  dayDate,
  nearbyVolumes,
  releaseDay,
  shortDate,
  shownHistory,
  shownOffers,
  storeLinksToShow,
  usualWhenWellBelow,
} from "./volumePageRules";

// the Impact script (index.html) that turns Walmart links into affiliate links
declare global {
  interface Window {
    impactStat?: (command: string) => void;
  }
}

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
  const page = useVolumeLoad(isbn, country);
  const loadedBook = page.data?.book ?? null;
  usePageMeta(page.data ? volumeMeta(page.data) : null);

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

  // Impact (Walmart affiliate) rewrites links once when its script loads,
  // before this page has drawn them, so ask it again once they exist
  const loaded = Boolean(page.data);
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

  if (page.loading) return <VolumeSkeleton />;
  if (page.error || !page.data) return <VolumeNotOpened onRetry={page.retry} />;

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
  } = page.data;
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
  const shownBook = novelParts(page.data.heading ?? book.title);
  // set in settings: they only want physical copies
  const hideEbooks = readLocal("hideEbooks") === "yes";
  const inCanada = country === "ca";
  const { shown: offers, hiddenEbooks } = shownOffers(allOffers, hideEbooks);
  const { history, lowestCents: lowestInHistory } = shownHistory(
    allHistory,
    hideEbooks,
  );
  const nearby = nearbyVolumes(siblings, volume, inBook);
  // a preorder's main buttons, and the other stores listed under them
  const { buttons: preorderAt, others: otherStores } = storeLinksToShow(
    storeLinks,
    offers,
    Boolean(preorder),
  );
  // the headline price is the cheapest new print copy, what most people buy
  const best = offers.find(
    (o) => o.condition === "new" && o.format === "print",
  );
  // a seller nobody has heard of: the cheapest at a store people know too
  const knownBest = knownStoreLow(offers);
  // the series' usual new price, when the headline is well above it
  const aboveUsual = usualWhenWellBelow(
    siblings,
    book.isbn13,
    best?.priceCents,
  );
  // above the other stores' links: what they're for
  let otherStoresTitle = "Check price at:";
  if (preorder) otherStoresTitle = "Or preorder at:";
  else if (offers.length > 0)
    otherStoresTitle = "Also worth checking, they could be cheaper:";
  // an old check, said beside the price it's about
  const stale =
    checkedAt && olderThanDays(checkedAt, 3) ? timeAgo(checkedAt) : null;

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
              {aboveUsual != null && (
                <span className={styles.bestAside}>
                  {" "}
                  · most volumes are about {formatCents(aboveUsual)}
                </span>
              )}
              {stale && (
                <span className={styles.bestAside}> · checked {stale}</span>
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
              volume={volume}
              preorder={preorder ? releaseDay(preorder) : null}
              seriesLink={seriesLink}
            />
          )}
          {!inCanada && (
            <section aria-labelledby="offers-title">
              <div className={styles.sectionHeadRow}>
                <h2 id="offers-title" className={styles.sectionTitle}>
                  Prices
                </h2>
                <span className={styles.checkedRow}>
                  {page.refreshing ? (
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
                  volume={volume}
                />
              ) : (
                <p className={styles.note}>
                  {page.refreshing ? (
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

              <BoxSetNote offers={allOffers} to={seriesLink} />

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
                    {otherStoresTitle}
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

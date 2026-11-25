// /deals: volumes whose cheapest new copy now is well under their usual new
// price, biggest discount first. Stored prices only (server: getDealsPage),
// so it never sets off a check; each card goes to the volume's page, where
// every store's price is. Sorted, and narrowed by genre, by manga or light
// novel, and (signed in) to series on the reader's shelf; the choices live
// in the address, as on All series. 24 to a page (useUrlPages)
import { useEffect, useMemo, useState } from "react";
import { NavLink, useSearchParams } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import RangePager from "../../components/rangePager/RangePager";
import { useUrlPages } from "../../components/rangePager/useUrlPages";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { getDeals, getDealsOnShelf, novelParts } from "../../lib/prices";
import { inCanada } from "../../lib/country";
import { usePageMeta } from "../../lib/seo";
import type { DealCard, PriceCard } from "../../lib/types";
import { useAuth } from "../../store/auth";
import { SortMenu } from "../Home/ShelfBar";
import VolumeCard from "./VolumeCard";
import { pricesStyles as styles } from "./styles";

const percentOff = (d: PriceCard) =>
  Math.round(100 - (100 * d.priceCents) / (d.avgCents ?? d.priceCents));

// the ways to order the deals; the first is the one with no ?sort= in the URL
const SORTS = [
  ["discount", "Biggest discount"],
  ["price", "Lowest price"],
  ["az", "A to Z"],
] as const;
type Sort = (typeof SORTS)[number][0];
const share = (d: DealCard) => d.priceCents / (d.avgCents || d.priceCents);
const sortName = (name: string) => name.replace(/^the\s+/i, "").toLowerCase();
const ORDER: Record<Sort, (a: DealCard, b: DealCard) => number> = {
  discount: (a, b) => share(a) - share(b),
  price: (a, b) => a.priceCents - b.priceCents || share(a) - share(b),
  az: (a, b) =>
    sortName(a.series).localeCompare(sortName(b.series)) ||
    (a.volume ?? 0) - (b.volume ?? 0),
};
const KINDS = [
  { value: "", label: "All books" },
  { value: "manga", label: "Manga" },
  { value: "novel", label: "Light novels" },
];

export default function Deals() {
  // deals are worked out from US prices only, for now: someone shopping in
  // Canada is told so rather than shown US prices
  const canada = inCanada();
  const [params, setParams] = useSearchParams();
  const sort: Sort =
    SORTS.find(([value]) => value === params.get("sort"))?.[0] ?? "discount";
  const genre = params.get("genre") ?? "";
  const kind = params.get("kind") ?? "";
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const mine = Boolean(isSignedIn) && params.get("shelf") === "mine";
  const [state, setState] = useState<{
    deals: DealCard[] | null;
    error: boolean;
  }>({ deals: null, error: false });
  // the deals of series on their shelf, by ISBN: asked for once they pick it
  const [onShelf, setOnShelf] = useState<Set<string> | null>(null);

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

  useEffect(() => {
    if (!mine || onShelf) return;
    const controller = new AbortController();
    getDealsOnShelf(controller.signal)
      .then((isbns) => setOnShelf(new Set(isbns)))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setOnShelf(new Set());
      });
    return () => controller.abort();
  }, [mine, onShelf]);

  const all = state.deals;
  // the genre in the address is offered even when no deal has it now, so
  // the picker never says "All genres" while one is picked
  const genres = useMemo(
    () =>
      [
        ...new Set([
          ...(all ?? []).flatMap((d) => d.genres),
          ...(genre ? [genre] : []),
        ]),
      ].sort(),
    [all, genre],
  );
  const hasNovels = useMemo(
    () => (all ?? []).some((d) => novelParts(d.title).lightNovel),
    [all],
  );
  const shown = useMemo(() => {
    if (!all) return null;
    if (mine && !onShelf) return null;
    return all
      .filter((d) => !genre || d.genres.includes(genre))
      .filter((d) => {
        if (!kind) return true;
        return novelParts(d.title).lightNovel === (kind === "novel");
      })
      .filter((d) => !mine || onShelf?.has(d.isbn13))
      .sort(ORDER[sort]);
  }, [all, genre, kind, mine, onShelf, sort]);
  const filtered = Boolean(genre || kind || mine);

  // a new choice starts again from the first page
  const setChoice = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next, { replace: true });
  };
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    for (const key of ["genre", "kind", "shelf", "page"]) next.delete(key);
    setParams(next, { replace: true });
  };

  const { pageItems, pager } = useUrlPages(shown ?? [], "deals-list");

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
          Volumes selling for less than they usually do. Open one to see every
          store's price.
        </p>
        {!canada && all && all.length > 0 && (
          <div className={styles.indexControls}>
            <div className={styles.segmented} role="group" aria-label="Sort">
              {SORTS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sort === value}
                  onClick={() =>
                    setChoice("sort", value === "discount" ? "" : value)
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {genres.length > 0 && (
              <div className={styles.genrePick}>
                <label htmlFor="deals-genre">Genre</label>
                <SortMenu
                  box
                  id="deals-genre"
                  menuLabel="Genre"
                  options={[
                    { value: "", label: "All genres" },
                    ...genres.map((g) => ({ value: g, label: g })),
                  ]}
                  sortBy={genre}
                  onSort={(value) => setChoice("genre", value)}
                />
              </div>
            )}
            {hasNovels && (
              <div className={styles.genrePick}>
                <label htmlFor="deals-kind">Books</label>
                <SortMenu
                  box
                  id="deals-kind"
                  menuLabel="Books"
                  options={KINDS}
                  sortBy={kind}
                  onSort={(value) => setChoice("kind", value)}
                />
              </div>
            )}
            {isSignedIn && (
              <div className={styles.genrePick}>
                <label htmlFor="deals-shelf">Series</label>
                <SortMenu
                  box
                  id="deals-shelf"
                  menuLabel="Series"
                  options={[
                    { value: "", label: "Every series" },
                    { value: "mine", label: "On my shelf" },
                  ]}
                  sortBy={mine ? "mine" : ""}
                  onSort={(value) => setChoice("shelf", value)}
                />
              </div>
            )}
          </div>
        )}
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

      {!canada && shown === null && !state.error && (
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

      {all && all.length > 0 && shown?.length === 0 && (
        <div className={styles.empty}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={styles.emptyTitle}>
            {mine && !genre && !kind
              ? "No deals on your series right now."
              : "No deals match those choices."}
          </p>
          <p>Deals change through the day as prices are checked.</p>
          {filtered && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearFilters}
            >
              Show every deal
            </button>
          )}
        </div>
      )}

      {shown && shown.length > 0 && (
        <>
          <div id="deals-list" className="scroll-mt-4" />
          <ul className={styles.grid}>
            {pageItems.map((d) => (
              <li key={d.isbn13}>
                <VolumeCard
                  {...d}
                  priceCents={d.priceCents}
                  wasCents={d.avgCents}
                  subtitle={`${percentOff(d)}% off`}
                />
              </li>
            ))}
          </ul>
          <RangePager {...pager} label="Deal pages" />
        </>
      )}
      {/* a short list isn't a broken one: deals come from prices as they're
          checked, so it grows and changes through the day */}
      {!filtered && shown && shown.length > 0 && shown.length < 8 && (
        <p className={styles.sub}>
          That's all for now. More turn up as prices are checked through the
          day.
        </p>
      )}
    </div>
  );
}

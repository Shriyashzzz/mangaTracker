// The New tab on a big shelf: the list sorted into piles (piles.ts). "Just
// out" shows its cards, Hide and all; the others a fan of covers and a count,
// each opening its own page. And that page's head: which pile, the chips to
// the others, and the way back
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router";
import DrawnCover from "../../components/drawnCover/DrawnCover";
import type { Manga } from "../../lib/types";
import {
  PILE_SORTS,
  PILE_TEXT,
  PILES,
  type Pile,
  type PileSort,
  type PileView,
} from "./piles";
import type { ReleaseKind } from "./shelfViews";
import { pilesStyles as styles } from "./pilesStyles";
import { SortMenu } from "./ShelfBar";

// cards shown from "Just out" before its See all
const JUST_OUT_SHOWN = 5;
// covers in a pile's fan
const FAN = 5;
// on wider screens, enough covers to fill about this much of the row
const FAN_SHARE = 0.65;
// a cover and the gap after it, in px (pilesStyles: w-[58px], gap-2.5)
const COVER_STEP = 68;
// below this the row keeps FAN covers (phones)
const WIDE_FROM = 520;

// how many covers the row has room for: FAN on phones, more on laptops
function useFanSize() {
  const row = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FAN);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const fit = () => {
      const width = el.getBoundingClientRect().width;
      setSize(
        width < WIDE_FROM
          ? FAN
          : Math.max(FAN, Math.floor((width * FAN_SHARE) / COVER_STEP) - 1),
      );
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return { row, size };
}

// where a cover goes when clicked, as its card would: the next volume's
// prices, its details page, or the grouped list (onOpen)
export type CoverLink = {
  to: string;
  onOpen?: () => void;
  // which one it's about: "Vol. 5", "Ch. 120"
  stamp: string;
};

function Fan({
  manga: all,
  onMore,
  linkFor,
}: {
  manga: Manga[];
  onMore: () => void;
  linkFor: (m: Manga) => CoverLink;
}) {
  const { row, size } = useFanSize();
  const manga = all.slice(0, size);
  const more = all.length - manga.length;
  return (
    <div className={styles.fan} ref={row}>
      {manga.map((m) => {
        const link = linkFor(m);
        return (
          <NavLink
            key={m.id}
            to={link.to}
            className={styles.fanCover}
            aria-label={`${m.name}: ${link.stamp}`}
            viewTransition
            onClick={
              link.onOpen
                ? (e) => {
                    e.preventDefault();
                    link.onOpen!();
                  }
                : undefined
            }
          >
            <span className={styles.fanArt} aria-hidden>
              {m.image ? (
                <img src={m.image} alt="" loading="lazy" />
              ) : (
                <DrawnCover title={m.name} />
              )}
            </span>
            <span className={styles.stamp} aria-hidden>
              {link.stamp}
            </span>
            {/* which series, on hover or keyboard focus (its name is in the
                link's label for screen readers already) */}
            <span className={styles.caption} aria-hidden>
              {m.name}
            </span>
          </NavLink>
        );
      })}
      {more > 0 && (
        <button
          type="button"
          className={styles.fanMore}
          onClick={onMore}
          tabIndex={-1}
          aria-hidden
        >
          +{more}
        </button>
      )}
    </div>
  );
}

export function NewPiles({
  kind,
  piles,
  card,
  gridClass,
  onOpen,
  returnTo,
  onCardClick,
  linkFor,
  extra,
}: {
  // added to a pile's line: how much there is to catch up on
  extra: (pile: Pile) => string;
  linkFor: (m: Manga) => CoverLink;
  kind: ReleaseKind;
  piles: Record<Pile, Manga[]>;
  // the pile they've just come back from: its See all gets the focus back
  returnTo: Pile | null;
  // remembers the spot before a card opens its page
  onCardClick: () => void;
  // a card as the list draws it, Hide button and all
  card: (m: Manga, index: number) => ReactNode;
  gridClass: string;
  onOpen: (pile: Pile) => void;
}) {
  useEffect(() => {
    if (returnTo) document.getElementById(`see-all-${returnTo}`)?.focus();
  }, [returnTo]);
  return (
    <div className={styles.piles} onClickCapture={onCardClick}>
      {PILES.filter((p) => piles[p].length > 0).map((p) => {
        const list = piles[p];
        const { name, why } = PILE_TEXT[kind][p];
        const cards = p === "just-out";

        return (
          <section
            key={p}
            className={styles.pile}
            aria-labelledby={`pile-${p}`}
          >
            <header className={styles.pileHead}>
              <h2 id={`pile-${p}`} className={styles.pileName}>
                {name} <span className={styles.pileCount}>{list.length}</span>
              </h2>
              <button
                type="button"
                id={`see-all-${p}`}
                className={styles.seeAll}
                onClick={() => onOpen(p)}
                aria-label={`See all ${list.length}: ${name}`}
              >
                See all
              </button>
            </header>
            <p className={styles.why}>
              {why}
              {extra(p)}
            </p>
            {cards ? (
              <div className={gridClass}>
                {list.slice(0, JUST_OUT_SHOWN).map(card)}
              </div>
            ) : (
              <Fan manga={list} onMore={() => onOpen(p)} linkFor={linkFor} />
            )}
          </section>
        );
      })}
    </div>
  );
}

// the head of a pile's own page
export function PileHead({
  kind,
  view,
  piles,
  onPick,
  onBack,
  viewingHidden,
  extra,
  sort,
  onSort,
}: {
  extra: (pile: Pile) => string;
  sort: PileSort;
  onSort: (sort: PileSort) => void;
  kind: ReleaseKind;
  view: PileView;
  // on the hidden list, whose piles Back returns to
  viewingHidden: boolean;
  piles: Record<Pile, Manga[]>;
  onPick: (view: PileView) => void;
  onBack: () => void;
}) {
  const all = PILES.reduce((n, p) => n + piles[p].length, 0);
  // the button that opened this is gone, so the heading takes the focus
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus({ preventScroll: true }), [view]);
  // phones: the chip row scrolls sideways, so the open pile's chip is brought
  // into sight (only the row moves, never the page)
  const chipList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = chipList.current;
    const on = list?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!list || !on || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = on.offsetLeft - (list.clientWidth - on.offsetWidth) / 2;
  }, [view]);
  // the chips stick under the shelf's own sticky bar, however tall it is
  const [below, setBelow] = useState(0);
  useEffect(() => {
    const bar = document.querySelector("[data-shelf-bar]");
    if (!bar) return;
    const fit = () => setBelow(bar.getBoundingClientRect().height);
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(bar);
    return () => watch.disconnect();
  }, []);
  const chips: { view: PileView; label: string; count: number }[] = [
    { view: "all", label: "All", count: all },
    // every pile, empty or not, so the chips never move about
    ...PILES.map((p) => ({
      view: p,
      label: PILE_TEXT[kind][p].name,
      count: piles[p].length,
    })),
  ];
  // the chips straight in the page, not in a box of their own: sticky only
  // holds inside its parent, and this one has to last the whole pile
  return (
    <>
      <div className={styles.headTop}>
        <h2 ref={title} tabIndex={-1} className={styles.headTitle}>
          {view === "all" ? "Everything new" : PILE_TEXT[kind][view].name}
        </h2>
        <button type="button" className={styles.back} onClick={onBack}>
          {viewingHidden ? "Back to Hidden" : "Back to New"}
        </button>
      </div>
      {/* "Everything new" says it already; a pile says what it holds */}
      {view !== "all" && (
        <p className={styles.headWhy}>
          {PILE_TEXT[kind][view].why + extra(view)}
        </p>
      )}
      <div className={styles.chips} style={{ top: below }}>
        {/* one row that scrolls sideways on phones, the sort at its end */}
        <div
          ref={chipList}
          className={styles.chipList}
          role="group"
          aria-label="Piles"
        >
          {chips.map((c) => (
            <button
              key={c.view}
              type="button"
              className={c.view === view ? styles.chipOn : styles.chip}
              aria-pressed={c.view === view}
              // nothing in it: there, so the row holds still, but no use
              disabled={c.count === 0 && c.view !== view}
              onClick={() => onPick(c.view)}
            >
              {c.label} <span className={styles.chipCount}>{c.count}</span>
            </button>
          ))}
        </div>
        {/* the same menu as the shelf's other tabs */}
        <div className={styles.sort}>
          <SortMenu sortBy={sort} onSort={onSort} options={PILE_SORTS} />
        </div>
      </div>
    </>
  );
}

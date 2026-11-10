// The New tab on a big shelf: the list sorted into piles (piles.ts). "Just
// out" shows its cards, Hide and all; the others a fan of covers and a count,
// each opening its own page. And that page's head: which pile, the chips to
// the others, and the way back
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router";
import DrawnCover from "../../components/drawnCover/DrawnCover";
import type { Manga } from "../../lib/types";
import { PILE_TEXT, PILES, type Pile, type PileView } from "./piles";
import type { ReleaseKind } from "./shelfViews";
import { pilesStyles as styles } from "./pilesStyles";

// cards shown from "Just out" before its See all
const JUST_OUT_SHOWN = 5;
// covers in a pile's fan
const FAN = 5;

// where a cover goes when clicked, as its card would: the next volume's
// prices, its details page, or the grouped list (onOpen)
export type CoverLink = {
  to: string;
  onOpen?: () => void;
  // which one it's about: "Vol. 5", "Ch. 120"
  stamp: string;
};

function Fan({
  manga,
  more,
  onMore,
  linkFor,
}: {
  manga: Manga[];
  more: number;
  onMore: () => void;
  linkFor: (m: Manga) => CoverLink;
}) {
  return (
    <div className={styles.fan}>
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
        const shown = cards ? JUST_OUT_SHOWN : FAN;
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
              <div className={gridClass}>{list.slice(0, shown).map(card)}</div>
            ) : (
              <Fan
                manga={list.slice(0, shown)}
                more={list.length - shown}
                onMore={() => onOpen(p)}
                linkFor={linkFor}
              />
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
}: {
  extra: (pile: Pile) => string;
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
      <p className={styles.headWhy}>
        {view === "all"
          ? "Everything new, in one list"
          : PILE_TEXT[kind][view].why + extra(view)}
      </p>
      <div
        className={styles.chips}
        style={{ top: below }}
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
    </>
  );
}

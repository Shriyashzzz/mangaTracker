import { useState } from "react";
import { NavLink } from "react-router";
import { ChevronDownIcon, InkCrossIcon } from "../../components/icons/Icons";
import { chaptersText, type ChapterRange } from "../../lib/chapterWords";
import { formatCents, seriesPath, volumePath } from "../../lib/prices";
import { onSale } from "../../lib/releaseDate";
import { runsOf } from "../../lib/volumeRuns";
import { detailsStyles as styles } from "./styles";
import type { SeriesVolume } from "../../lib/types";
import type { BuyOptions } from "./useBuyOptions";
import type { Editions } from "./useEditions";
import { SortMenu } from "../Home/ShelfBar";
import {
  editionBookLabel,
  insideText,
  type EditionBook,
  type EditionLine,
} from "../../lib/editions";
import { offlineLink, orOffline, useIsOffline } from "../../lib/offline";

// where to buy more of this manga: the next volume they need, the newest in the
// US, and a link to the whole series (saying how many aren't on the shelf). Stays out of the way when the series can't be
// found under the name on the shelf
type Props = {
  // on phones: folded under one line ("Buy next · Vol. 15 · $8.99") that
  // opens it, high on the page instead of at the bottom
  folded?: boolean;
  // they've bought an edition's next book: record it and its volumes
  onOwnBook?: (line: EditionLine, book: EditionBook) => Promise<void>;
  // "On my shelf" on a single volume's ticket: that volume theirs
  onOwnVolume?: (volume: number) => Promise<void>;
  // volumes ordered and on their way, and saying some are (or aren't): one
  // volume, or an edition's book's volumes
  ordered?: number[];
  onOrdered?: (volumes: number[], ordered: boolean) => Promise<void>;
  options: BuyOptions;
  // the red bar is already selling the next volume
  hideNext: boolean;
  // the book the red bar sells, if any: an edition's next book sold there
  // isn't priced again here (the bar's button has the price)
  barSells?: string | null;
  // the series' omnibus and deluxe lines, and the one they collect
  editions: Editions;
  // "singles" or a line's key
  onCollect: (key: string) => void;
  // for someone reading by the chapter with no books: the chapters in the
  // book "Next for you" offers, said beside it ("Vol. 5 · ch. 34–42")
  nextChapters?: ChapterRange | null;
  // how many volumes the page says the series has ("You own 22 of 22"):
  // the same count here, where the catalog may know fewer (20th Century
  // Boys: 3 of its 22 listed)
  shelfTotal?: number;
  // they own none of this series: a reader, not a collector yet, so the
  // heading isn't a push to buy
  ownsNone?: boolean;
};

// an edition's book: its own price page when the catalog has its ISBN, else
// the series' page to look for it
const bookPath = (book: EditionBook, label: string, seriesName: string) =>
  book.isbn13
    ? volumePath(book.isbn13, book.title ?? label)
    : seriesPath(seriesName);
// what a book's ticket says where its price goes: the price we know, a
// nudge to check it, or (the catalog has no ISBN for it) to look for it
function bookPrice(book: EditionBook) {
  if (book.knownPriceCents != null) return formatCents(book.knownPriceCents);
  return book.isbn13 ? "check price" : "find it";
}

const price = (v: SeriesVolume) =>
  v.knownPriceCents != null ? formatCents(v.knownPriceCents) : "check price";

// gaps listed by name; past this, "+N more", a link to the series page with
// its "Not on your shelf" list on
const GAPS_SHOWN = 2;

export default function BuyStrip({
  options,
  hideNext,
  barSells = null,
  editions,
  onCollect,
  nextChapters = null,
  shelfTotal = 0,
  folded = false,
  onOwnBook,
  onOwnVolume,
  ordered = [],
  onOrdered,
  ownsNone = false,
}: Props) {
  const offline = useIsOffline();
  // the box's heading, laptop and folded phone line alike
  const title = ownsNone ? "The books" : "Buy next";
  // the first ticket's label. For someone who owns none of the series it
  // says what the book is to them, not that it's theirs to buy next
  const nextLabel = !ownsNone
    ? "Next for you"
    : nextChapters
      ? "Your next chapters are in"
      : "Next volume";
  // its price: for that reader, only one we know, never a "check price"
  // nudge
  const knownOnly = (cents: number | null | undefined) =>
    cents != null ? formatCents(cents) : null;
  // "I own Deluxe 7" saving, and whether it failed
  const [owning, setOwning] = useState(false);
  const [ownFailed, setOwnFailed] = useState(false);
  // "I ordered it" saving, and whether it failed
  const [ordering, setOrdering] = useState(false);
  const [orderFailed, setOrderFailed] = useState(false);
  const order = (volumes: number[], on: boolean) => {
    if (!onOrdered) return;
    setOrdering(true);
    setOrderFailed(false);
    onOrdered(volumes, on)
      .catch(() => setOrderFailed(true))
      .finally(() => setOrdering(false));
  };
  const { line, plan } = editions;
  const { loading, volumes, latest, next, unlisted, caughtUp, seriesName } =
    options;
  // the gaps under "Not on your shelf": not the one "Next for you" already
  // names (their first gap, when they've chosen that)
  const gaps = options.gaps.filter((g) => g.volume !== next?.volume);
  // as the shelf counts them: up to the newest one out, listed or not
  // (Detective Conan: 98, though only 65 have a book listed)
  // (Jujutsu Kaisen: 29, its vol. 0 said apart, as the page above says it)
  const out = onSale(volumes);
  const numbered = out.filter(
    (v) => Number.isInteger(v.volume) && v.volume >= 1,
  );
  const outCount = Math.max(
    numbered.length,
    shelfTotal,
    ...numbered.map((v) => v.volume),
  );
  const coming = volumes.length - out.length;

  if (loading) {
    return <div className={`skeleton ${styles.buySkeleton}`} aria-hidden />;
  }
  if (!latest) return null;

  const titleId = folded ? "buy-title-folded" : "buy-title";
  // the folded line's ticket, as the open box lists them: the book they
  // need next (unless the red bar sells it already), else the first gap,
  // else the newest. Never a volume they own: caught up says so. A price
  // only when one is known (never "check price" there)
  const firstNext = line && plan?.next;
  // the red bar sells this very book: named here, priced only there
  const nextOnBar = Boolean(
    barSells && plan?.next?.isbn13 && plan.next.isbn13 === barSells,
  );
  const withPrice = (book: string, cents: number | null | undefined) =>
    cents != null ? `${book} · ${formatCents(cents)}` : book;
  const firstGap = gaps[0];
  const gapCents = out.find(
    (v) => v.volume === firstGap?.volume,
  )?.knownPriceCents;
  const summary = firstNext
    ? withPrice(
        editionBookLabel(line, firstNext),
        nextOnBar ? null : firstNext.knownPriceCents,
      )
    : unlisted != null && !hideNext
      ? `Vol. ${unlisted}`
      : next && !hideNext
        ? withPrice(`Vol. ${next.volume}`, next.knownPriceCents)
        : firstGap
          ? withPrice(`Vol. ${firstGap.volume}`, gapCents)
          : next
            ? withPrice(`Vol. ${next.volume}`, next.knownPriceCents)
            : caughtUp
              ? "Caught up"
              : withPrice(`Vol. ${latest.volume}`, latest.knownPriceCents);

  // what's ordered and on its way, each run with a way to take it back
  // (both layouts: single volumes and an edition's books)
  const orderedLine = ordered.length > 0 && (
    <li className={styles.buyOrdered}>
      <span className={styles.buyOrderedLabel}>Ordered:</span>
      <span className={styles.buyGapList}>
        {runsOf(ordered).map((run) => {
          const said =
            run.length === 1
              ? `Vol. ${run[0]}`
              : `Vols. ${run[0]}–${run.at(-1)}`;
          return (
            <button
              key={run[0]}
              type="button"
              className={`${styles.buyGap} inline-flex items-center gap-1`}
              aria-label={`${said}: not ordered after all`}
              disabled={ordering}
              onClick={() => order(run, false)}
              {...offlineLink(offline)}
            >
              {said}
              <InkCrossIcon className="size-[0.7rem]" />
            </button>
          );
        })}
      </span>
    </li>
  );

  // the series' page, with how many are out ("All 43 volumes"). Collecting
  // an edition: that edition's books, opened there ("All 12 VIZBIG books")
  const singlesText =
    outCount <= 1 && !coming
      ? "The series"
      : `All ${outCount} volumes${coming ? ` + ${coming} coming` : ""}`;
  const seriesLink = (className: string) => (
    <NavLink
      className={className}
      to={
        line
          ? `${seriesPath(seriesName)}&${new URLSearchParams({ edition: line.key })}`
          : seriesPath(seriesName)
      }
      viewTransition
      {...offlineLink(offline)}
    >
      {/* out now, as the shelf's "of 15" counts them; preorders apart */}
      {/* an edition's books out, as "You have all 12 VIZBIG books" counts them */}
      {line && plan && plan.outBooks > 1
        ? `All ${plan.outBooks} ${line.label} books`
        : singlesText}{" "}
      →
    </NavLink>
  );

  const box = (
    <section
      className={folded ? styles.buyOpened : styles.buy}
      aria-labelledby={titleId}
      data-tour={folded ? undefined : "buy"}
    >
      {/* the heading, and beside it which edition they buy (only when the
          series has another): "Buy next as Deluxe" */}
      <div className={styles.buyHead}>
        <h2 id={titleId} className={styles.deskTitle}>
          {title}
        </h2>
        {editions.lines.length > 0 && (
          // the tour's "single, deluxe or omnibus" step points here
          <span data-tour="edition">
            <SortMenu
              lead="as"
              menuLabel="Buy next as"
              // folded on phones it sits at the left edge: the list opens
              // rightward, never off the screen
              alignLeft={folded}
              wordy
              sortBy={line?.key ?? "singles"}
              onSort={onCollect}
              // what each book of its lines holds: the editions page, with
              // the lookup
              footer={{
                to: `/editions?${new URLSearchParams({ series: seriesName })}`,
                label: "See all editions →",
              }}
              options={[
                { value: "singles", label: "Single" },
                ...editions.lines.map((l) => ({
                  value: l.key,
                  label: l.label,
                })),
              ]}
            />
          </span>
        )}
        {folded && seriesLink(styles.buySeriesTop)}
      </div>
      {line && plan ? (
        <ul className={styles.buyList}>
          {plan.next && (
            <li className="relative">
              <NavLink
                className={`${styles.buyNext} ${onOrdered || onOwnBook ? styles.buyNextRoom : ""}`}
                to={bookPath(plan.next, line.label, seriesName)}
                viewTransition
                {...offlineLink(offline)}
              >
                <span className={styles.buyNextKind}>{nextLabel}</span>
                <span>{editionBookLabel(line, plan.next)}</span>
                {!nextOnBar && (
                  <span className={styles.buyPrice}>
                    {ownsNone
                      ? knownOnly(plan.next.knownPriceCents)
                      : bookPrice(plan.next)}
                  </span>
                )}
                {/* what's inside it, on its own line under the ticket's row */}
                <em className={styles.buyInside}>
                  {insideText(plan.next)}
                  {plan.next.have > 0 &&
                    `, you have ${plan.next.have} of ${plan.next.volumes.length}`}
                </em>
              </NavLink>
              {/* bought it, or ordered it: one tap each, for the book and all
                  its volumes. Pills in the ticket's corner (beside the link,
                  never inside it: a button can't sit in a link) */}
              <span className={styles.ticketPills}>
                {onOwnBook && (
                  <button
                    type="button"
                    className={styles.ticketPill}
                    disabled={owning}
                    aria-label={`${editionBookLabel(line, plan.next)}: on my shelf`}
                    onClick={() => {
                      setOwning(true);
                      setOwnFailed(false);
                      onOwnBook(line, plan.next!)
                        .catch(() => setOwnFailed(true))
                        .finally(() => setOwning(false));
                    }}
                  >
                    {owning ? "Saving…" : "On my shelf"}
                  </button>
                )}
                {onOrdered && (
                  <button
                    type="button"
                    className={styles.ticketPill}
                    disabled={ordering}
                    aria-label={`${editionBookLabel(line, plan.next)}: ordered`}
                    onClick={() => order(plan.next!.volumes, true)}
                    {...offlineLink(offline)}
                  >
                    {ordering ? "Saving…" : "Ordered"}
                  </button>
                )}
              </span>
              {(ownFailed || orderFailed) && (
                <span className={styles.buyOwnFailed} role="alert">
                  {orOffline("That didn't save. Try again.")}
                </span>
              )}
            </li>
          )}
          {plan.gaps.length > 0 && (
            <li className={styles.buyGaps}>
              <span className={styles.buyKind}>Not on your shelf</span>
              <span className={styles.buyGapList}>
                {plan.gaps.slice(0, GAPS_SHOWN).map((g) => (
                  <NavLink
                    key={g.number}
                    to={bookPath(g, line.label, seriesName)}
                    className={styles.buyGap}
                    title={`${insideText(g)}${g.have ? `, you have ${g.have} of ${g.volumes.length}` : ""}`}
                    // the same for TalkBack, which never sees a tooltip
                    aria-label={`${editionBookLabel(line, g)}: ${insideText(g)}${g.have ? `, you have ${g.have} of ${g.volumes.length}` : ""}`}
                    viewTransition
                    {...offlineLink(offline)}
                  >
                    {editionBookLabel(line, g)}
                  </NavLink>
                ))}
                {/* the rest: the series page with "Not on your shelf" on */}
                {plan.gaps.length > GAPS_SHOWN && (
                  <NavLink
                    // seriesPath already has its ?name=, so this joins with &
                    to={`${seriesPath(seriesName)}&toget=1`}
                    className={`${styles.buyGap} italic`}
                    viewTransition
                    {...offlineLink(offline)}
                  >
                    +{plan.gaps.length - GAPS_SHOWN} more
                  </NavLink>
                )}
              </span>
            </li>
          )}
          {plan.caughtUp && (
            <li className={styles.buyNote}>
              <span className={styles.buyKind}>Caught up</span>
              You have all {plan.outBooks} {line.label} books listed
              {/* volumes out past the last book, sold only on their own */}
              {outCount > plan.lastVolume && plan.lastVolume > 0 && (
                <em className={styles.buyInside}>
                  {outCount === plan.lastVolume + 1
                    ? `Vol. ${outCount} isn't in a ${line.label} book yet.`
                    : `Vols. ${plan.lastVolume + 1}–${outCount} aren't in a ${line.label} book yet.`}
                </em>
              )}
            </li>
          )}
          {/* last: what's on its way, under the tickets */}
          {orderedLine}
        </ul>
      ) : (
        <ul className={styles.buyList}>
          {/* the next one with no book listed: said, never skipped */}
          {unlisted != null && !hideNext && (
            <li className="relative">
              <div
                className={`${styles.buyNext} ${onOrdered ? styles.buyNextRoom : ""}`}
              >
                <span className={styles.buyNextKind}>{nextLabel}</span>
                <span>Vol. {unlisted}</span>
                <span className={styles.buyPrice}>not listed yet</span>
              </div>
              {onOrdered && (
                <span className={styles.ticketPills}>
                  {onOwnVolume && (
                    <button
                      type="button"
                      className={styles.ticketPill}
                      disabled={owning}
                      aria-label={`Vol. ${unlisted}: on my shelf`}
                      onClick={() => {
                        setOwning(true);
                        setOwnFailed(false);
                        onOwnVolume(unlisted)
                          .catch(() => setOwnFailed(true))
                          .finally(() => setOwning(false));
                      }}
                    >
                      {owning ? "Saving…" : "On my shelf"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.ticketPill}
                    disabled={ordering}
                    aria-label={`Vol. ${unlisted}: ordered`}
                    onClick={() => order([unlisted], true)}
                    {...offlineLink(offline)}
                  >
                    {ordering ? "Saving…" : "Ordered"}
                  </button>
                </span>
              )}
            </li>
          )}
          {next && !hideNext && (
            <li className="relative">
              <NavLink
                className={`${styles.buyNext} ${onOrdered ? styles.buyNextRoom : ""}`}
                to={volumePath(next.isbn13, next.title)}
                viewTransition
                {...offlineLink(offline)}
              >
                <span className={styles.buyNextKind}>{nextLabel}</span>
                <span>
                  Vol. {next.volume}
                  {/* a chapter reader: the chapters in it, under it */}
                  {nextChapters && (
                    <span className={styles.buyChapters}>
                      {chaptersText(nextChapters)}
                    </span>
                  )}
                </span>
                <span className={styles.buyPrice}>
                  {ownsNone ? knownOnly(next.knownPriceCents) : price(next)}
                </span>
              </NavLink>
              {/* bought it somewhere and it's on its way: Next moves past it */}
              {onOrdered && (
                <span className={styles.ticketPills}>
                  {onOwnVolume && (
                    <button
                      type="button"
                      className={styles.ticketPill}
                      disabled={owning}
                      aria-label={`Vol. ${next.volume}: on my shelf`}
                      onClick={() => {
                        setOwning(true);
                        setOwnFailed(false);
                        onOwnVolume(next.volume)
                          .catch(() => setOwnFailed(true))
                          .finally(() => setOwning(false));
                      }}
                    >
                      {owning ? "Saving…" : "On my shelf"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.ticketPill}
                    disabled={ordering}
                    aria-label={`Vol. ${next.volume}: ordered`}
                    onClick={() => order([next.volume], true)}
                    {...offlineLink(offline)}
                  >
                    {ordering ? "Saving…" : "Ordered"}
                  </button>
                </span>
              )}
              {(ownFailed || orderFailed) && (
                <span className={styles.buyOwnFailed} role="alert">
                  {orOffline("That didn't save. Try again.")}
                </span>
              )}
            </li>
          )}
          {/* the gaps behind them: Next goes past these, a collector filling
            the run wants each one */}
          {gaps.length > 0 && (
            <li className={styles.buyGaps}>
              <span className={styles.buyKind}>Not on your shelf</span>
              <span className={styles.buyGapList}>
                {gaps.slice(0, GAPS_SHOWN).map((g) => (
                  <NavLink
                    key={g.volume}
                    // one the catalog doesn't list: the series' own list
                    to={
                      g.isbn13
                        ? volumePath(g.isbn13, g.title)
                        : `${seriesPath(seriesName)}&toget=1`
                    }
                    className={styles.buyGap}
                    viewTransition
                    {...offlineLink(offline)}
                  >
                    Vol. {g.volume}
                  </NavLink>
                ))}
                {/* the rest: the series page with "Not on your shelf" on */}
                {gaps.length > GAPS_SHOWN && (
                  <NavLink
                    // seriesPath already has its ?name=, so this joins with &
                    to={`${seriesPath(seriesName)}&toget=1`}
                    className={`${styles.buyGap} italic`}
                    viewTransition
                    {...offlineLink(offline)}
                  >
                    +{gaps.length - GAPS_SHOWN} more
                  </NavLink>
                )}
              </span>
            </li>
          )}
          {caughtUp ? (
            <li className={styles.buyNote}>
              <span className={styles.buyKind}>Caught up</span>
              {/* the catalog knowing fewer than they own: their count, not its
                  newest ("Vol. 3 is the newest" beside "22 of 22") */}
              {shelfTotal > latest.volume
                ? `You own up to vol. ${shelfTotal}`
                : `Vol. ${latest.volume} is the newest in English`}
            </li>
          ) : (
            next?.isbn13 !== latest.isbn13 && (
              <li>
                <NavLink
                  className={styles.buyLink}
                  to={volumePath(latest.isbn13, latest.title)}
                  viewTransition
                  {...offlineLink(offline)}
                >
                  <span className={styles.buyKind}>Newest</span>
                  <span>Vol. {latest.volume}</span>
                  <span className={styles.buyPrice}>
                    {ownsNone
                      ? knownOnly(latest.knownPriceCents)
                      : price(latest)}
                  </span>
                </NavLink>
              </li>
            )
          )}
          {/* last: what's on its way, under the tickets */}
          {orderedLine}
        </ul>
      )}
      {/* a way to look further, not something to buy, so not a ticket.
          (A "Finish the series" ticket that went to the same page is gone:
          the Not on your shelf ticket and the shelf above say the rest).
          Folded on a phone, it's up beside "as Deluxe" instead, a line saved */}
      {!folded && seriesLink(styles.buySeries)}
    </section>
  );
  if (!folded) return box;
  return (
    <details className={styles.buyFold} data-tour="buy">
      <summary className={styles.buyFoldSummary}>
        <span className={styles.buyFoldTitle}>{title}</span>
        <span className={styles.buyFoldTicket}>{summary}</span>
        <ChevronDownIcon className={styles.buyFoldChevron} />
      </summary>
      {box}
    </details>
  );
}

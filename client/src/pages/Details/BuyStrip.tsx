import { useState } from "react";
import { NavLink } from "react-router";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { chaptersText, type ChapterRange } from "../../lib/chapterWords";
import { formatCents, seriesPath, volumePath } from "../../lib/prices";
import { onSale } from "../../lib/releaseDate";
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

// where to buy more of this manga: the next volume they need, the newest in the
// US, and a link to the whole series (saying how many aren't on the shelf). Stays out of the way when the series can't be
// found under the name on the shelf
type Props = {
  // on phones: folded under one line ("Buy next · Vol. 15 · $8.99") that
  // opens it, high on the page instead of at the bottom
  folded?: boolean;
  // they've bought an edition's next book: record it and its volumes
  onOwnBook?: (line: EditionLine, book: EditionBook) => Promise<void>;
  options: BuyOptions;
  // the red bar is already selling the next volume
  hideNext: boolean;
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

// gaps listed by name; past this, the series page's "Not on your shelf"
const GAPS_SHOWN = 6;

export default function BuyStrip({
  options,
  hideNext,
  editions,
  onCollect,
  nextChapters = null,
  shelfTotal = 0,
  folded = false,
  onOwnBook,
}: Props) {
  // "I own Deluxe 7" saving, and whether it failed
  const [owning, setOwning] = useState(false);
  const [ownFailed, setOwnFailed] = useState(false);
  const { line, plan } = editions;
  const { loading, volumes, latest, next, caughtUp, seriesName } = options;
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
  const withPrice = (book: string, cents: number | null | undefined) =>
    cents != null ? `${book} · ${formatCents(cents)}` : book;
  const firstGap = gaps[0];
  const gapCents = out.find(
    (v) => v.volume === firstGap?.volume,
  )?.knownPriceCents;
  const summary = firstNext
    ? withPrice(editionBookLabel(line, firstNext), firstNext.knownPriceCents)
    : next && !hideNext
      ? withPrice(`Vol. ${next.volume}`, next.knownPriceCents)
      : firstGap
        ? withPrice(`Vol. ${firstGap.volume}`, gapCents)
        : next
          ? withPrice(`Vol. ${next.volume}`, next.knownPriceCents)
          : caughtUp
            ? "Caught up"
            : withPrice(`Vol. ${latest.volume}`, latest.knownPriceCents);

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
          Buy next
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
      </div>
      {line && plan ? (
        <ul className={styles.buyList}>
          {plan.next && (
            <li>
              <NavLink
                className={styles.buyNext}
                to={bookPath(plan.next, line.label, seriesName)}
                viewTransition
              >
                <span className={styles.buyNextKind}>Next for you</span>
                <span>{editionBookLabel(line, plan.next)}</span>
                <span className={styles.buyPrice}>{bookPrice(plan.next)}</span>
                {/* what's inside it, on its own line under the ticket's row */}
                <em className={styles.buyInside}>
                  {insideText(plan.next)}
                  {plan.next.have > 0 &&
                    `, you have ${plan.next.have} of ${plan.next.volumes.length}`}
                </em>
              </NavLink>
              {/* bought it: one tap records the book and its volumes */}
              {onOwnBook && (
                <button
                  type="button"
                  className={styles.buyOwn}
                  disabled={owning}
                  onClick={() => {
                    setOwning(true);
                    setOwnFailed(false);
                    onOwnBook(line, plan.next!)
                      .catch(() => setOwnFailed(true))
                      .finally(() => setOwning(false));
                  }}
                >
                  {owning
                    ? "Saving…"
                    : `I own ${editionBookLabel(line, plan.next)}`}
                </button>
              )}
              {ownFailed && (
                <span className={styles.buyOwnFailed} role="alert">
                  That didn't save. Try again.
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
                    viewTransition
                  >
                    {editionBookLabel(line, g)}
                  </NavLink>
                ))}
                {plan.gaps.length > GAPS_SHOWN && (
                  <span className={styles.buyAside}>
                    +{plan.gaps.length - GAPS_SHOWN} more
                  </span>
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
        </ul>
      ) : (
        <ul className={styles.buyList}>
          {next && !hideNext && (
            <li>
              <NavLink
                className={styles.buyNext}
                to={volumePath(next.isbn13, next.title)}
                viewTransition
              >
                <span className={styles.buyNextKind}>Next for you</span>
                <span>
                  Vol. {next.volume}
                  {/* a chapter reader: the chapters in it, under it */}
                  {nextChapters && (
                    <span className={styles.buyChapters}>
                      {chaptersText(nextChapters)}
                    </span>
                  )}
                </span>
                <span className={styles.buyPrice}>{price(next)}</span>
              </NavLink>
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
                  >
                    Vol. {g.volume}
                  </NavLink>
                ))}
                {gaps.length > GAPS_SHOWN && (
                  <NavLink
                    // seriesPath already has its ?name=, so this joins with &
                    to={`${seriesPath(seriesName)}&toget=1`}
                    className={styles.buyGap}
                    viewTransition
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
                >
                  <span className={styles.buyKind}>Newest</span>
                  <span>Vol. {latest.volume}</span>
                  <span className={styles.buyPrice}>{price(latest)}</span>
                </NavLink>
              </li>
            )
          )}
        </ul>
      )}
      {/* a way to look further, not something to buy, so not a ticket.
          (A "Finish the series" ticket that went to the same page is gone:
          the Not on your shelf ticket and the shelf above say the rest) */}
      <NavLink
        className={styles.buySeries}
        to={seriesPath(seriesName)}
        viewTransition
      >
        {/* out now, as the shelf's "of 15" counts them; preorders apart */}
        {outCount <= 1 && !coming
          ? "The series"
          : `All ${outCount} volumes${coming ? ` + ${coming} coming` : ""}`}{" "}
        →
      </NavLink>
    </section>
  );
  if (!folded) return box;
  return (
    <details className={styles.buyFold} data-tour="buy">
      <summary className={styles.buyFoldSummary}>
        <span className={styles.buyFoldTitle}>Buy next</span>
        <span className={styles.buyFoldTicket}>{summary}</span>
        <ChevronDownIcon className={styles.buyFoldChevron} />
      </summary>
      {box}
    </details>
  );
}

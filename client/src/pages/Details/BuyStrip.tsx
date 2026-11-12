import { NavLink } from "react-router";
import { formatCents, seriesPath, volumePath } from "../../lib/prices";
import { finishMoney } from "../../lib/finishCost";
import { onSale } from "../../lib/releaseDate";
import { detailsStyles as styles } from "./styles";
import type { SeriesVolume } from "../../lib/types";
import type { BuyOptions } from "./useBuyOptions";
import type { Editions } from "./useEditions";
import {
  editionBookLabel,
  insideText,
  type EditionBook,
  type EditionPlan,
} from "../../lib/editions";

// where to buy more of this manga: the next volume they need, the newest in the
// US, and the whole series' prices. Stays out of the way when the series can't be
// found under the name on the shelf
type Props = {
  options: BuyOptions;
  // the red bar is already selling the next volume
  hideNext: boolean;
  // the series' omnibus and deluxe lines, and the one they collect
  editions: Editions;
  // "singles" or a line's key
  onCollect: (key: string) => void;
};

// an edition's book: its own price page when the catalog has its ISBN, else
// the series' page to look for it
const bookPath = (book: EditionBook, label: string, seriesName: string) =>
  book.isbn13
    ? volumePath(book.isbn13, book.title ?? label)
    : seriesPath(seriesName);
const bookPrice = (book: EditionBook) =>
  book.knownPriceCents != null
    ? formatCents(book.knownPriceCents)
    : book.isbn13
      ? "check price"
      : "find it";

// what the rest of an edition costs: the stored prices, stretched over the
// books that have none yet
const editionMoney = (plan: EditionPlan) =>
  !plan.pricedCount
    ? "check prices"
    : plan.pricedCount === plan.left.length
      ? formatCents(plan.pricedCents)
      : `about ${formatCents(
          Math.round(
            ((plan.pricedCents / plan.pricedCount) * plan.left.length) / 100,
          ) * 100,
        )}`;

const price = (v: SeriesVolume) =>
  v.knownPriceCents != null ? formatCents(v.knownPriceCents) : "check price";

// gaps listed by name; past this, the series page's "Not on your shelf"
const GAPS_SHOWN = 6;

export default function BuyStrip({
  options,
  hideNext,
  editions,
  onCollect,
}: Props) {
  const { line, plan } = editions;
  const { loading, volumes, latest, next, caughtUp, finish, seriesName, gaps } =
    options;
  // as the shelf counts them: up to the newest one out, listed or not
  // (Detective Conan: 98, though only 65 have a book listed)
  const out = onSale(volumes);
  const outCount = Math.max(
    out.length,
    ...out.map((v) => v.volume).filter(Number.isInteger),
  );
  const coming = volumes.length - out.length;

  if (loading) {
    return <div className={`skeleton ${styles.buySkeleton}`} aria-hidden />;
  }
  if (!latest) return null;

  return (
    <section className={styles.buy} aria-labelledby="buy-title">
      <h2 id="buy-title" className={styles.deskTitle}>
        Buy it
      </h2>
      {/* which edition they buy: only when the series has another */}
      {editions.lines.length > 0 && (
        <label className={styles.buyCollect}>
          <span>Collecting</span>
          <select
            className={styles.buyCollectSelect}
            value={line?.key ?? "singles"}
            onChange={(e) => onCollect(e.target.value)}
          >
            <option value="singles">Single volumes</option>
            {editions.lines.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}
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
            </li>
          )}
          {plan.gaps.length > 0 && (
            <li className={styles.buyGaps}>
              <span className={styles.buyKind}>Missing</span>
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
            </li>
          )}
          {plan.left.length > 0 && (
            <li>
              <NavLink
                className={styles.buyLink}
                to={bookPath(plan.left[0]!, line.label, seriesName)}
                title="At the last checked prices. A book gets a price once someone opens its page"
                viewTransition
              >
                <span className={styles.buyKind}>Finish the series</span>
                <span className={styles.buyCount}>
                  <span>
                    {plan.left.length} book{plan.left.length === 1 ? "" : "s"}
                  </span>
                  {plan.pricedCount > 0 &&
                    plan.pricedCount < plan.left.length && (
                      <em className={styles.buyAside}>(est)</em>
                    )}
                </span>
                <span className={styles.buyPrice}>{editionMoney(plan)}</span>
              </NavLink>
            </li>
          )}
          {plan.later > 0 && (
            <li className={styles.buyLater}>
              {plan.later} more to come, or not listed yet.
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
                <span>Vol. {next.volume}</span>
                <span className={styles.buyPrice}>{price(next)}</span>
              </NavLink>
            </li>
          )}
          {/* the gaps behind them: Next goes past these, a collector filling
            the run wants each one */}
          {gaps.length > 0 && (
            <li className={styles.buyGaps}>
              <span className={styles.buyKind}>Missing</span>
              <span className={styles.buyGapList}>
                {gaps.slice(0, GAPS_SHOWN).map((g) => (
                  <NavLink
                    key={g.isbn13}
                    to={volumePath(g.isbn13, g.title)}
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
              Vol. {latest.volume} is the newest in English
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
          {finish && (
            <li>
              <NavLink
                className={styles.buyLink}
                // seriesPath already has its ?name=, so this joins with &
                to={`${seriesPath(seriesName)}&toget=1`}
                title="At the last checked prices. A volume gets a price once someone opens its page"
                viewTransition
              >
                <span className={styles.buyKind}>Finish the series</span>
                <span className={styles.buyCount}>
                  <span>
                    {finish.left} vol{finish.left === 1 ? "" : "s"}
                  </span>
                  {finish.priced < finish.left && (
                    <em className={styles.buyAside}>(est)</em>
                  )}
                </span>
                <span className={styles.buyPrice}>
                  {finishMoney(finish, formatCents)}
                </span>
              </NavLink>
            </li>
          )}
        </ul>
      )}
      {/* a way to look further, not something to buy, so not a ticket */}
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
}

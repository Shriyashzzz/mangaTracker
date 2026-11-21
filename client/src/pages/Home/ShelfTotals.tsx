// "How much is my shelf worth?": what they've spent, what the shelf would
// fetch used, and what finishing every series comes to, folded under one
// line that says the worth itself once it's known. On the shelf's Volumes
// tab (the numbers: server collector/, useShelfTools.ts)
import { ChevronDownIcon } from "../../components/icons/Icons";
import { totalText, type ShelfTools } from "../../lib/collector";
import { formatPaid } from "../../lib/prices";
import { volumesStyles as styles } from "./volumesStyles";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

// the whole shelf: what it would fetch used, and what finishing every series
// comes to. An estimate says so, with how much of it is real prices
// said under a total that isn't of every volume yet: prices for the rest
// are found in the background (server collector/filler.ts, usedFiller.ts)
const FILL_IN = "The rest fill in over a few days.";
// what the shelf's worth is: what it would fetch, not what it cost
const SOLD_USED = "If sold used, at today's prices";

// "4 of 5 priced so far. The rest fill in over a few days."
const pricedSoFar = (priced: number, of: number) =>
  `${priced.toLocaleString()} of ${of.toLocaleString()} priced so far. ${FILL_IN}`;

// under "To finish your series", one sentence a line: what the total is
// for, any series left out of it, and how far the pricing has got.
//   For the 133 volumes you don't have yet.
//   5 of 133 priced so far. The rest fill in over a few days.
function finishNote(tools: ShelfTools, hasTotal: boolean) {
  // a series collected as its deluxe books counts in books
  const unit = tools.finish.some((f) => f.edition) ? "book" : "volume";
  const allPriced = tools.finishPriced >= tools.finishMissing;
  const lines = [
    `For the ${plural(tools.finishMissing, unit)} you don't have yet.`,
  ];
  // the total is of the series priced enough to say
  if (tools.finishUncosted && hasTotal)
    lines.push(
      `${plural(tools.finishUncosted, "series", "series")} not counted yet.`,
    );
  if (!allPriced)
    lines.push(pricedSoFar(tools.finishPriced, tools.finishMissing));
  return lines;
}

export default function ShelfTotals({
  tools,
  owned,
}: {
  tools: ShelfTools;
  owned: number;
}) {
  const { value } = tools;
  // every owned volume, as the line above counts them (the server's count
  // leaves out specials and volumes no list has yet): a total is exact only
  // when all of them are priced
  const ownedVolumes = Math.max(owned, value.volumes + value.unlisted);
  const worth = totalText(
    value.cents,
    value.priced,
    ownedVolumes,
    value.estimateCents,
  );
  const finish = totalText(
    tools.finishCents,
    tools.finishPriced,
    tools.finishMissing,
    tools.finishEstimateCents,
  );
  const spent = tools.spent?.books ? tools.spent : null;
  if (!ownedVolumes && !tools.finishMissing && !spent) return null;
  // folded until asked: a question to open, not two numbers in the way
  return (
    <details className={styles.worth} data-tour="worth">
      <summary className={styles.worthSummary}>
        {/* the answer itself once there is one, the question until then */}
        {worth && ownedVolumes > 0 ? (
          <span>
            Your shelf is worth{" "}
            <strong className={styles.worthAmount}>{worth}</strong>
          </span>
        ) : (
          "How much is my shelf worth?"
        )}
        <ChevronDownIcon className={styles.worthChevron} />
      </summary>
      <dl className={styles.totals}>
        {/* what they've said they paid, on each series' page ("Your books") */}
        {spent && (
          <div className={styles.total}>
            <dt className={styles.totalLabel}>You've spent</dt>
            <dd className={styles.totalValue}>{formatPaid(spent.cents)}</dd>
            <dd className={styles.totalNote}>
              on the {plural(spent.books, "book")} you added a price to
            </dd>
          </div>
        )}
        {ownedVolumes > 0 && (
          <div className={styles.total}>
            <dt className={styles.totalLabel}>Your shelf is worth</dt>
            {/* no money until enough is priced (the server's
                enoughToEstimate), as "To finish" below */}
            <dd className={styles.totalValue}>{worth ?? "no total yet"}</dd>
            {/* what "worth" means: resale, not what they paid */}
            {worth && value.priced >= ownedVolumes && (
              <dd className={styles.totalNote}>{SOLD_USED}.</dd>
            )}
            {worth && value.priced < ownedVolumes && (
              // the total is of every volume, worked out from the ones
              // priced; the background jobs price the rest over a few days
              // said plainly: it's the whole shelf, not only what's priced
              <>
                <dd className={styles.totalNote}>
                  An estimate for all {plural(ownedVolumes, "volume")}, if sold
                  used at today's prices.
                </dd>
                <dd className={styles.totalNote}>
                  {value.priced.toLocaleString()} priced so far, the rest at
                  their series' usual price.
                </dd>
              </>
            )}
            {!worth && (
              <dd className={styles.totalNote}>
                {pricedSoFar(value.priced, ownedVolumes)}
              </dd>
            )}
          </div>
        )}
        {tools.finishMissing > 0 && (
          <div className={styles.total}>
            <dt className={styles.totalLabel}>To finish your series</dt>
            {/* no money until enough is priced: the count is still true */}
            <dd className={styles.totalValue}>{finish ?? "no total yet"}</dd>
            {finishNote(tools, Boolean(finish)).map((line) => (
              <dd key={line} className={styles.totalNote}>
                {line}
              </dd>
            ))}
          </div>
        )}
      </dl>
    </details>
  );
}

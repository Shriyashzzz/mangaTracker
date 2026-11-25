// "How much is my shelf worth?": what they've spent, what the shelf would
// fetch used, and what finishing every series comes to, folded under one
// line that says the worth itself once it's known. Amounts only, as the
// apps show them; "about" says an estimate. On the shelf's Volumes
// tab (the numbers: server collector/, useShelfTools.ts)
import { ChevronDownIcon } from "../../components/icons/Icons";
import { totalText, type ShelfTools } from "../../lib/collector";
import { formatPaid } from "../../lib/prices";
import { volumesStyles as styles } from "./volumesStyles";

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
      {/* the amounts and nothing under them: "about" says an estimate */}
      <dl className={styles.totals}>
        {/* what they've said they paid, on each series' page ("Your books") */}
        {spent && (
          <div className={styles.total}>
            <dt className={styles.totalLabel}>You've spent</dt>
            <dd className={styles.totalValue}>{formatPaid(spent.cents)}</dd>
          </div>
        )}
        {ownedVolumes > 0 && (
          <div className={styles.total}>
            <dt className={styles.totalLabel}>Your shelf is worth</dt>
            <dd className={styles.totalValue}>{worth ?? "no total yet"}</dd>
          </div>
        )}
        {tools.finishMissing > 0 && (
          <div className={styles.total}>
            <dt className={styles.totalLabel}>To finish your series</dt>
            <dd className={styles.totalValue}>{finish ?? "no total yet"}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}

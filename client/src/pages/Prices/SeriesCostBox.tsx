// What collecting a whole series costs new, at the prices already stored: the
// question a collector asks before starting one. Shown to everyone; someone
// with it on their shelf gets "Finish the series" beside the volumes instead,
// so this is for deciding. Never asks for a price (lib/finishCost.ts)
import { NavLink } from "react-router";
import { formatCents } from "../../lib/prices";
import type { SeriesCost } from "../../lib/finishCost";
import { pricesStyles as styles } from "./styles";

export default function SeriesCostBox({
  cost,
  isSignedIn,
  comingSoon,
}: {
  cost: SeriesCost;
  isSignedIn: boolean | null;
  // volumes listed but not out yet: "all 9 out now" beside a title saying 12
  comingSoon: boolean;
}) {
  const all = cost.complete;
  // too few priced to say what the lot costs: nothing rather than a guess
  if (cost.estimateCents == null) return null;
  // an estimate to the nearest $10: cents would claim a precision it lacks
  const total = all
    ? cost.estimateCents
    : Math.round(cost.estimateCents / 1000) * 1000;
  return (
    <aside className={styles.costBox} aria-labelledby="series-cost-title">
      <div className={styles.costText}>
        <h2 id="series-cost-title" className={styles.costLabel}>
          Collect every volume
        </h2>
        <p className={styles.costTotal}>
          {all ? "" : "About "}
          <strong>
            {all
              ? formatCents(total)
              : `$${(total / 100).toLocaleString("en-US")}`}
          </strong>{" "}
          new for all {cost.volumes}
          {comingSoon && " out now"}
        </p>
        {/* only when every volume is priced: an estimate says "About" */}
        {all && (
          <p className={styles.costNote}>
            At the lowest new price we've found for each, about{" "}
            {formatCents(Math.round(cost.cents / cost.volumes))} a volume.
          </p>
        )}
        {/* an estimate, on a page where most covers have no price yet */}
        {!all && (
          <p className={styles.costNote}>
            An estimate, from the volumes we have prices for.
          </p>
        )}
      </div>
      {isSignedIn === false && (
        <NavLink to="/signup" className="btn btn-primary" viewTransition>
          Track what you own
        </NavLink>
      )}
    </aside>
  );
}

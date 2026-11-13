// What collecting a whole series costs new, at the prices already stored: the
// question a collector asks before starting one. Under it, what the used
// copies on sale now come to, for however many volumes have one. Shown to everyone; someone
// with it on their shelf gets "Finish the series" beside the volumes instead,
// so this is for deciding. Never asks for a price (lib/finishCost.ts)
import { NavLink } from "react-router";
import { formatCents } from "../../lib/prices";
import type { SeriesCost } from "../../lib/finishCost";
import { pricesStyles as styles } from "./styles";

export default function SeriesCostBox({
  cost,
  used,
  isSignedIn,
  comingSoon,
}: {
  cost: SeriesCost;
  // the used copies found for the same volumes: how many, and what they
  // cost together; null when none has one
  used: { volumes: number; cents: number } | null;
  isSignedIn: boolean | null;
  // volumes listed but not out yet: "all 9 out now" beside a title saying 12
  comingSoon: boolean;
}) {
  const all = cost.complete;
  // too few priced to say what the lot costs: how many are priced so far,
  // never a guess (the FAQ promises the same)
  const sayTotal = cost.estimateCents != null && cost.enough;
  if (!sayTotal && !used) return null;
  if (cost.estimateCents == null || !sayTotal)
    return (
      <aside className={styles.costBox} aria-labelledby="series-cost-title">
        <div className={styles.costText}>
          <h2 id="series-cost-title" className={styles.costLabel}>
            Collect every volume
          </h2>
          <p className={styles.costNote}>
            New prices found for {cost.priced} of {cost.volumes} so far. A total
            shows once most have one.
          </p>
          {used && <UsedLine used={used} volumes={cost.volumes} />}
        </div>
        {isSignedIn === false && <TrackButton />}
      </aside>
    );
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
        {/* second-hand: only the copies really on sale, never a guess for
            the rest */}
        {used && <UsedLine used={used} volumes={cost.volumes} />}
      </div>
      {isSignedIn === false && <TrackButton />}
    </aside>
  );
}

function UsedLine({
  used,
  volumes,
}: {
  used: { volumes: number; cents: number };
  volumes: number;
}) {
  return (
    <p className={styles.costNote}>
      {used.volumes >= volumes
        ? `All ${volumes} are on sale used`
        : `Used copies found for ${used.volumes} of ${volumes}`}
      : <strong>{formatCents(used.cents)}</strong> together.
    </p>
  );
}

const TrackButton = () => (
  <NavLink to="/signup" className="btn btn-primary" viewTransition>
    Track what you own
  </NavLink>
);

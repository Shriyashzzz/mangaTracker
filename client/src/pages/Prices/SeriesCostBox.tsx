// What collecting a whole series costs, new and used, at the prices already
// stored: the question a collector asks before starting one. Two lines and
// nothing under them: "About $1,060 new", "About $830 used", each exact
// once every volume has a price. Shown to everyone; someone with it on their
// shelf gets "Finish the series" beside the volumes instead, so this is for
// deciding. Never asks for a price (lib/finishCost.ts)
import { NavLink, useLocation } from "react-router";
import { formatCents, wholeMoney } from "../../lib/prices";
import { runTotal, type SeriesCost } from "../../lib/finishCost";
import { pricesStyles as styles } from "./styles";

// "$1,059.43 new" when exact, else "About $1,060 new" (to the nearest $10)
function Total({
  cents,
  exact,
  kind,
}: {
  cents: number;
  exact: boolean;
  kind: string;
}) {
  return (
    <p className={styles.costTotal}>
      {exact ? "" : "About "}
      <strong>
        {exact
          ? formatCents(cents)
          : wholeMoney(Math.round(cents / 1000) * 1000)}
      </strong>{" "}
      {kind}
    </p>
  );
}

export default function SeriesCostBox({
  cost,
  used,
  isSignedIn,
  comingSoon,
  title,
  also = null,
}: {
  cost: SeriesCost;
  // what all of it comes to used (lib/finishCost.ts usedCopies); null when
  // no volume has a used copy on sale
  used: { estimateCents: number; complete: boolean } | null;
  isSignedIn: boolean | null;
  // volumes listed but not out yet: "all 9 out now" beside a title saying 12
  comingSoon: boolean;
  // an edition's own page: "Collect all 12 VIZBIG books", and what the
  // singles come to under it ("Singles: about $880 for all 37")
  title?: string;
  also?: string | null;
}) {
  const run = runTotal(cost);
  if (!run && !used) return null;
  return (
    <aside
      className={styles.costBox}
      aria-labelledby="series-cost-title"
      data-tour="series-cost"
    >
      <div className={styles.costText}>
        <h2 id="series-cost-title" className={styles.costLabel}>
          {title ?? (
            <>
              Collect all {cost.volumes}
              {comingSoon && " out now"}
            </>
          )}
        </h2>
        {run && <Total cents={run.cents} exact={run.exact} kind="new" />}
        {used && (
          <Total cents={used.estimateCents} exact={used.complete} kind="used" />
        )}
        {also && <p className="mt-1 text-ink-soft">{also}</p>}
      </div>
      {isSignedIn === false && <TrackButton />}
    </aside>
  );
}

// signing up brings them back to this series, not to an empty shelf
function TrackButton() {
  const { pathname } = useLocation();
  return (
    <NavLink
      to={`/signup?${new URLSearchParams({ next: pathname })}`}
      className="btn btn-primary"
      viewTransition
    >
      Track what you own
    </NavLink>
  );
}

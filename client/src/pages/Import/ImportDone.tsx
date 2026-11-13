// The end of a list import: what was added, what was already there, and the
// way back to the shelf.
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import type { ImportTotals } from "../../lib/imports/malImport";
import { importStyles as styles } from "./styles";

const series = (n: number) => `${n} series`;

// the headline: new series, or only new volumes, or nothing new
function titleFor(totals: ImportTotals) {
  if (totals.added) return `${series(totals.added)} added!`;
  if (totals.volumesAdded) return "Volumes added!";
  return "All already there!";
}

// what happened to the series already on the shelf
function alreadyThereLine(totals: ImportTotals) {
  if (totals.alreadyThere <= 0) return "";
  const already = series(totals.alreadyThere);
  return totals.volumesAdded
    ? `${already} already on your shelf; ${series(totals.volumesAdded)} got the new volumes from your file, nothing else changed. `
    : `${already} already on your shelf, so we left them alone. `;
}

export default function ImportDone({ totals }: { totals: ImportTotals }) {
  return (
    <div className={`${styles.page} fade-in`}>
      <section className={`${styles.sheet} ${styles.result}`}>
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="happy" />
        </span>
        <h1 className={styles.resultTitle} role="status">
          {titleFor(totals)}
        </h1>
        <p className={styles.resultBody}>
          {alreadyThereLine(totals)}
          {totals.noCover > 0 &&
            `${series(totals.noCover)} came in without a cover. You can add one with Edit details.`}
        </p>
        <NavLink
          to="/shelf"
          className="btn btn-primary btn-lg mt-2"
          viewTransition
        >
          Go to my shelf
        </NavLink>
      </section>
    </div>
  );
}

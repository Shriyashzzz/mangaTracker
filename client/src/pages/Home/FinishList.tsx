// Under an opened series on the Volumes tab: what finishing it comes to, the
// missing volumes we know a price for (cheapest new copy, and where), and the
// rest in one line, with the series' page to check them on. Prices are the
// ones already saved: a volume is priced once someone opens its page.
import { useState } from "react";
import { NavLink } from "react-router";
import {
  money,
  totalText,
  type FinishRow,
  type MissingVolume,
} from "../../lib/collector";
import { rangesText } from "../../lib/ownedVolumes";
import { seriesPath, volumePath } from "../../lib/prices";
import { noteStoreClick } from "../../lib/support";
import { volumesStyles as styles } from "./volumesStyles";

// a long list of priced gaps starts folded
const FIRST_SHOWN = 8;

// our affiliate tags, as the price pages mark them: paid links
const isAffiliate = (url: string) =>
  /[?&](tag|campid)=|bookshop\.org\/a\//.test(url);

export default function FinishList({
  row,
  series,
}: {
  row: FinishRow;
  // the series as the price pages know it (a light novel's own name)
  series: string;
}) {
  const [all, setAll] = useState(false);
  const priced = row.missing.filter((m) => m.cheapest);
  const unpriced = row.missing.filter((m) => !m.cheapest);
  const shown = all ? priced : priced.slice(0, FIRST_SHOWN);
  const total = totalText(
    row.cents,
    row.priced,
    row.missing.length,
    row.estimateCents,
  );
  return (
    <div className={styles.finish}>
      <h3 className={styles.finishHeading}>
        To finish it
        {total && <span className={styles.finishTotal}>{total}</span>}
      </h3>
      {unpriced.length > 0 && row.estimateCents !== null && (
        <p className={styles.finishNote}>
          {row.priced
            ? `${row.priced} of ${row.missing.length} priced; the rest at the series' usual price.`
            : "None priced yet: an estimate from the usual price."}
        </p>
      )}
      {shown.length > 0 && (
        <ul className={styles.finishList}>
          {shown.map((m) => (
            <li key={`${m.volume}-${m.isbn13}`} className={styles.finishRow}>
              <span className={styles.finishVol}>Vol. {m.volume}</span>
              <Where volume={m} />
            </li>
          ))}
        </ul>
      )}
      {priced.length > FIRST_SHOWN && (
        <button
          type="button"
          className={styles.edit}
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          {all ? "Show fewer" : `Show all ${priced.length} priced`}
        </button>
      )}
      {unpriced.length > 0 && (
        <p className={styles.unpriced}>
          <span className={styles.unpricedVols}>
            {unpriced.length === 1 ? "Vol." : "Vols."}{" "}
            {rangesText(unpriced.map((m) => m.volume))}
          </span>{" "}
          · no price yet.{" "}
          <NavLink
            to={seriesPath(series)}
            className={styles.edit}
            viewTransition
          >
            Check them on the series page
          </NavLink>
        </p>
      )}
    </div>
  );
}

function Where({ volume }: { volume: MissingVolume }) {
  const cheapest = volume.cheapest!;
  const label = (
    <>
      <span className={styles.finishPrice}>{money(cheapest.cents)}</span> at{" "}
      {cheapest.store}
    </>
  );
  // no store link saved: its own page has the prices
  if (!cheapest.url)
    return (
      <NavLink
        to={volumePath(volume.isbn13, volume.title)}
        className={styles.finishLink}
        viewTransition
      >
        {label}
      </NavLink>
    );
  return (
    <a
      href={cheapest.url}
      target="_blank"
      rel={isAffiliate(cheapest.url) ? "sponsored noreferrer" : "noreferrer"}
      className={styles.finishLink}
      onClick={noteStoreClick}
      onAuxClick={noteStoreClick}
      aria-label={`Volume ${volume.volume}: ${money(cheapest.cents)} new at ${cheapest.store}. Opens the store in a new tab`}
    >
      {label}
    </a>
  );
}

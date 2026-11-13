// Under an opened series on the Volumes tab: what finishing it comes to, the
// first couple of missing volumes we know a price for (cheapest new copy, and
// where), and the series' page for the rest. Prices are the ones already
// saved: a volume is priced once someone opens its page.
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

// the next ones to buy; the series page has them all
const FIRST_SHOWN = 2;

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
  const priced = row.missing.filter((m) => m.cheapest);
  const unpriced = row.missing.filter((m) => !m.cheapest);
  const shown = priced.slice(0, FIRST_SHOWN);
  const rest = row.missing.length - shown.length;
  // a deluxe or omnibus line is counted in books
  const unit = row.edition ? "book" : "volume";
  const total = totalText(
    row.cents,
    row.priced,
    row.missing.length,
    row.estimateCents,
  );
  return (
    <div className={styles.finish}>
      <h2 className={styles.finishHeading}>
        To finish it
        {total && <span className={styles.finishTotal}>{total}</span>}
      </h2>
      {/* too few priced for a total: said, so the missing number isn't a puzzle */}
      {unpriced.length > 0 && row.estimateCents === null && (
        <p className={styles.finishNote}>
          {row.priced} of {row.missing.length} priced: not enough yet for a
          total. Prices fill in as volumes are checked.
        </p>
      )}
      {unpriced.length > 0 && row.estimateCents !== null && (
        <p className={styles.finishNote}>
          {row.priced
            ? `${row.priced} of ${row.missing.length} priced; the rest at the series' usual price.`
            : "None priced yet: an estimate from the usual price."}
        </p>
      )}
      <ul className={styles.finishList}>
        {shown.map((m) => (
          <li key={`${m.volume}-${m.isbn13}`} className={styles.finishRow}>
            <span
              className={styles.finishVol}
              title={
                m.inside
                  ? `${m.inside.length === 1 ? "vol." : "vols."} ${rangesText(m.inside)}`
                  : undefined
              }
            >
              {m.label ?? `Vol. ${m.volume}`}
            </span>
            <Where volume={m} />
          </li>
        ))}
        {/* the rest, as the list's last row: the series page has every one */}
        {rest > 0 && (
          <li className={`${styles.finishRow} ${styles.finishRestRow}`}>
            <span className={styles.finishRest}>
              {shown.length > 0 ? `${rest} more` : rest} {unit}
              {rest === 1 ? "" : "s"}
            </span>
            <NavLink
              to={seriesPath(series)}
              className={styles.finishMore}
              aria-label={`Check the series page for ${shown.length > 0 ? "the other " : ""}${rest} ${unit}${rest === 1 ? "" : "s"}`}
              viewTransition
            >
              Check the series page
            </NavLink>
          </li>
        )}
      </ul>
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
      aria-label={`${volume.label ?? `Volume ${volume.volume}`}: ${money(cheapest.cents)} new at ${cheapest.store}. Opens the store in a new tab`}
    >
      {label}
    </a>
  );
}

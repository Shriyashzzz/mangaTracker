// Under an opened series on the Volumes tab: what finishing it comes to, the
// first couple to get (cheapest new copy, and where), and the series' page
// for the rest. In the order Buy next takes them: the next after theirs,
// then their gaps, unless they chose gaps first (Settings, Next in line). A
// long run of gaps is one line, never a shopping list of each. Prices are the
// ones already saved: a volume is priced once someone opens its page; one
// that isn't yet says "check price", a link to its page.
import { NavLink } from "react-router";
import {
  money,
  totalText,
  type FinishRow,
  type MissingVolume,
} from "../../lib/collector";
import { rangesText } from "../../lib/ownedVolumes";
import { useNextFor } from "../../lib/prefs";
import { toGetLines } from "../../lib/toGetLines";
import { seriesPath, volumePath, shopName } from "../../lib/prices";
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
  owned,
}: {
  row: FinishRow;
  // the series as the price pages know it (a light novel's own name)
  series: string;
  // what they own: what's a gap and what comes after
  owned: number[];
}) {
  const unpriced = row.missing.filter((m) => !m.cheapest);
  const lines = toGetLines(row.missing, owned, useNextFor() === "gap");
  const shown = lines.slice(0, FIRST_SHOWN);
  const shownCount = shown.reduce(
    (n, l) => n + (l.kind === "run" ? l.volumes.length : 1),
    0,
  );
  const rest = row.missing.length - shownCount;
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
        // one idea a line: where it stands, then what happens next
        <p className={styles.finishNote}>
          {row.priced} of {row.missing.length} priced: not enough yet for a
          total.
          <br />
          Prices fill in as volumes are checked.
        </p>
      )}
      {unpriced.length > 0 && row.estimateCents !== null && (
        <p className={styles.finishNote}>
          {row.priced
            ? `${row.priced} of ${row.missing.length} priced; the rest at the series' usual price.`
            : "An estimate. No prices checked yet."}
        </p>
      )}
      <ul className={styles.finishList}>
        {shown.map((line) =>
          line.kind === "run" ? (
            <GapRun
              key={`run-${line.volumes[0]!.volume}`}
              volumes={line.volumes}
              series={series}
            />
          ) : (
            <li
              key={`${line.volume.volume}-${line.volume.isbn13}`}
              className={styles.finishRow}
            >
              <span
                className={styles.finishVol}
                title={
                  line.volume.inside
                    ? `${line.volume.inside.length === 1 ? "vol." : "vols."} ${rangesText(line.volume.inside)}`
                    : undefined
                }
              >
                {line.volume.label ?? `Vol. ${line.volume.volume}`}
              </span>
              <Where volume={line.volume} />
            </li>
          ),
        )}
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

// a long run of gaps, as one line: "Vols. 6–59 · 54 volumes", its total
// when enough of it is priced, and the series page for each one's price
function GapRun({
  volumes,
  series,
}: {
  volumes: MissingVolume[];
  series: string;
}) {
  const priced = volumes.filter((v) => v.cheapest);
  const cents = priced.reduce((n, v) => n + v.cheapest!.cents, 0);
  // the same rule as the list's total: all priced, or none said
  const total = priced.length === volumes.length ? money(cents) : null;
  const first = volumes[0]!.volume;
  const last = volumes[volumes.length - 1]!.volume;
  return (
    <li className={styles.finishRow}>
      <span className={styles.finishVol}>
        Vols. {first}–{last}
        <span className="ml-2 font-normal text-muted">
          {volumes.length} volumes
        </span>
      </span>
      <NavLink
        to={seriesPath(series)}
        className={styles.finishLink}
        viewTransition
      >
        {total ? (
          <span className={styles.finishPrice}>{total}</span>
        ) : (
          "check prices"
        )}
      </NavLink>
    </li>
  );
}

function Where({ volume }: { volume: MissingVolume }) {
  const cheapest = volume.cheapest;
  // no price saved yet: its page checks
  if (!cheapest)
    return (
      <NavLink
        to={volumePath(volume.isbn13, volume.title)}
        className={styles.finishLink}
        viewTransition
      >
        check price
      </NavLink>
    );
  const label = (
    <>
      <span className={styles.finishPrice}>{money(cheapest.cents)}</span> at{" "}
      {shopName(cheapest.store)}
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
      aria-label={`${volume.label ?? `Volume ${volume.volume}`}: ${money(cheapest.cents)} new at ${shopName(cheapest.store)}. Opens the store in a new tab`}
    >
      {label}
    </a>
  );
}

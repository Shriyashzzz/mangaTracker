import { useId, useState } from "react";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { detailsStyles as styles } from "./styles";
import type { ReleaseData } from "../../lib/types";

type Props = {
  latestVolume: number;
  volumesOwned: number;
  data: ReleaseData;
};

type Row = { label: string; what: string; when: string; estimate?: boolean };

// the rows MangaDex had something to say about; "undefined" is what the
// server sends when it has no date to give
const rowsFrom = ({ chapter, newVolume }: ReleaseData) => {
  const rows: Row[] = [];
  const latest = chapter?.latestReleased;
  if (latest?.chapterNumber) {
    rows.push({
      label: "Newest chapter",
      what: `Ch. ${latest.chapterNumber}`,
      when: latest.releaseDate,
    });
  }
  const next = chapter?.estimateRelease;
  if (next?.chapterNumber && next.releaseDate !== "undefined") {
    rows.push({
      label: "Next chapter",
      what: `Ch. ${next.chapterNumber}`,
      when: next.releaseDate,
      estimate: next.isEstimate,
    });
  }
  if (newVolume?.volume && newVolume.releaseDate !== "undefined") {
    rows.push({
      label: "Next volume",
      what: `Vol. ${newVolume.volume}`,
      when: newVolume.releaseDate,
      estimate: newVolume.isEstimate,
    });
  }
  return rows;
};

// "there's a new volume": beside the entry on a laptop, a bar that folds open
// on anything narrower
export default function ReleasePanel({
  latestVolume,
  volumesOwned,
  data,
}: Props) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const rows = rowsFrom(data);
  const headline = `Vol. ${latestVolume} is out!`;

  return (
    <section className={styles.release} aria-label="New release">
      <span className={styles.releaseStamp} aria-hidden>
        Psst!
      </span>

      <div className={styles.releaseHit}>
        <h2 className={styles.releaseHeadline}>{headline}</h2>
        <p className={styles.releaseOwned}>You own up to vol. {volumesOwned}.</p>
      </div>
      <button
        type="button"
        className={styles.releaseBar}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.releaseBarHeadline}>{headline}</span>
        <span className={styles.releaseBarOwned}>you own {volumesOwned}</span>
        <ChevronDownIcon />
      </button>

      {rows.length > 0 && (
        <dl
          id={bodyId}
          className={`${styles.releaseRows} ${open ? "" : styles.releaseRowsShut}`}
        >
          {rows.map((row) => (
            <div key={row.label} className={styles.releaseRow}>
              <dt className={styles.releaseLabel}>{row.label}</dt>
              <dd className={styles.releaseValue}>
                {row.what} <span className={styles.releaseWhen}>· {row.when}</span>
                {row.estimate && (
                  <span className={styles.releaseEstimate}>estimate</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

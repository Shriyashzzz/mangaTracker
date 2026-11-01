import { useId, useState } from "react";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { detailsStyles as styles } from "./styles";
import type { ReleaseData } from "../../lib/types";

type Props = {
  latestVolume: number;
  volumesOwned: number | null;
  latestJapaneseVolume: number | null;
  data: ReleaseData | null;
};

type Row = { label: string; what: string; when?: string; estimate?: boolean };

// the rows MangaDex had something to say about; "undefined" is what the
// server sends when it has no date to give. Its next volume date follows the
// Japanese editions, so it's labelled as that rather than passed off as English
const rowsFrom = (
  data: ReleaseData | null,
  latestVolume: number,
  latestJapaneseVolume: number | null,
) => {
  const rows: Row[] = [];
  const latest = data?.chapter?.latestReleased;
  if (latest?.chapterNumber && latest.releaseDate !== "undefined") {
    rows.push({
      label: "Newest English chapter",
      what: `Ch. ${latest.chapterNumber}`,
      when: latest.releaseDate,
    });
  }
  const next = data?.chapter?.estimateRelease;
  if (next?.chapterNumber && next.releaseDate !== "undefined") {
    rows.push({
      label: "Next English chapter",
      what: `Ch. ${next.chapterNumber}`,
      when: next.releaseDate,
      estimate: next.isEstimate,
    });
  }
  // only worth saying when Japan is ahead of the English edition
  if (latestJapaneseVolume && latestJapaneseVolume > latestVolume) {
    rows.push({
      label: "Newest volume in Japan",
      what: `Vol. ${latestJapaneseVolume}`,
    });
  }
  const volume = data?.newVolume;
  if (volume?.volume && volume.releaseDate !== "undefined") {
    rows.push({
      label: "Next volume in Japan",
      what: `Vol. ${volume.volume}`,
      when: volume.releaseDate,
      estimate: volume.isEstimate,
    });
  }
  return rows;
};

// "there's a new volume in English": beside the entry on a laptop, a bar that
// folds open on anything narrower
export default function ReleasePanel({
  latestVolume,
  volumesOwned,
  latestJapaneseVolume,
  data,
}: Props) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const rows = rowsFrom(data, latestVolume, latestJapaneseVolume);
  const headline = `Vol. ${latestVolume} is out!`;
  const barText = (
    <>
      <span className={styles.releaseBarHeadline}>{headline}</span>
      <span className={styles.releaseBarOwned}>
        in English{volumesOwned ? ` · you own ${volumesOwned}` : ""}
      </span>
    </>
  );

  return (
    <section className={styles.release} aria-label="New English release">
      <span className={styles.releaseStamp} aria-hidden>
        Psst!
      </span>

      <div className={styles.releaseHit}>
        <h2 className={styles.releaseHeadline}>{headline}</h2>
        <p className={styles.releaseOwned}>
          In English.{volumesOwned ? ` You own up to vol. ${volumesOwned}.` : ""}
        </p>
      </div>

      {/* nothing to fold open if MangaDex had no dates */}
      {rows.length > 0 ? (
        <button
          type="button"
          className={styles.releaseBar}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          {barText}
          <ChevronDownIcon />
        </button>
      ) : (
        <p className={styles.releaseBarPlain}>{barText}</p>
      )}

      {rows.length > 0 && (
        <dl
          id={bodyId}
          className={`${styles.releaseRows} ${open ? "" : styles.releaseRowsShut}`}
        >
          {rows.map((row) => (
            <div key={row.label} className={styles.releaseRow}>
              <dt className={styles.releaseLabel}>{row.label}</dt>
              <dd className={styles.releaseValue}>
                {row.what}{" "}
                {row.when && (
                  <span className={styles.releaseWhen}>· {row.when}</span>
                )}
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

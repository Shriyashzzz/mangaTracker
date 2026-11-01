import { useId, useState } from "react";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { detailsStyles as styles } from "./styles";
import type { ReleaseData } from "../../lib/types";

type Props = {
  volume: number;
  inJapan: boolean;
  volumesOwned: number | null;
  data: ReleaseData | null;
};

type Row = { what: string; when: string; estimate?: boolean };
type Group = { title: string; rows: Row[] };

// "undefined" is what the server sends when it has no date to give
const hasDate = (date?: string) => Boolean(date) && date !== "undefined";

// English: its chapters, since there are no English volume dates to go on.
// Japan: its volumes only, since MangaDex has translations and no Japanese
// chapters. The volume that's out already is the panel's headline
const groupsFrom = (data: ReleaseData | null, inJapan: boolean): Group[] => {
  const outNow: Row[] = [];
  const comingUp: Row[] = [];

  if (inJapan) {
    const next = data?.newVolume;
    if (next?.volume && hasDate(next.releaseDate)) {
      comingUp.push({
        what: `Vol. ${next.volume}`,
        when: next.releaseDate,
        estimate: next.isEstimate,
      });
    }
  } else {
    const latest = data?.chapter?.latestReleased;
    if (latest?.chapterNumber && hasDate(latest.releaseDate)) {
      outNow.push({
        what: `Ch. ${latest.chapterNumber}`,
        when: latest.releaseDate,
      });
    }
    const next = data?.chapter?.estimateRelease;
    if (next?.chapterNumber && hasDate(next.releaseDate)) {
      comingUp.push({
        what: `Ch. ${next.chapterNumber}`,
        when: next.releaseDate,
        estimate: next.isEstimate,
      });
    }
  }

  return [
    { title: "Out now", rows: outNow },
    { title: "Coming up", rows: comingUp },
  ].filter((group) => group.rows.length > 0);
};

// "there's a new volume": beside the entry on a laptop, a bar that folds open
// on anything narrower
export default function ReleasePanel({
  volume,
  inJapan,
  volumesOwned,
  data,
}: Props) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const groups = groupsFrom(data, inJapan);
  const headline = `Vol. ${volume} is out!`;
  const where = inJapan ? "Japan" : "English";
  const place = inJapan ? "in Japan" : "in English";
  const barText = (
    <>
      <span className={styles.releaseBarHeadline}>{headline}</span>
      <span className={styles.releaseBarOwned}>
        {place}
        {volumesOwned ? ` · you own ${volumesOwned}` : ""}
      </span>
    </>
  );

  return (
    <section className={styles.release} aria-label={`New release, ${where}`}>
      <span className={styles.releaseStamp} aria-hidden>
        Psst!
      </span>

      <div className={styles.releaseHit}>
        <h2 className={styles.releaseHeadline}>{headline}</h2>
        <p className={styles.releaseOwned}>
          {inJapan ? "In Japan." : "In English."}
          {volumesOwned ? ` You own up to vol. ${volumesOwned}.` : ""}
        </p>
      </div>

      {/* nothing to fold open if MangaDex had no dates */}
      {groups.length > 0 ? (
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

      {groups.length > 0 && (
        <div
          id={bodyId}
          className={`${styles.releaseBody} ${open ? "" : styles.releaseBodyShut}`}
        >
          {groups.map((group) => (
            <div key={group.title} className={styles.releaseGroup}>
              <h3 className={styles.releaseGroupTitle}>{group.title}</h3>
              {group.rows.map((row) => (
                <p key={row.what} className={styles.releaseRow}>
                  <span className={styles.releaseWhat}>{row.what}</span>
                  <span className={styles.releaseWhen}>
                    {row.when}
                    {row.estimate && (
                      <abbr
                        className={styles.releaseEstimate}
                        title="Estimated from past releases"
                      >
                        est.
                      </abbr>
                    )}
                  </span>
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

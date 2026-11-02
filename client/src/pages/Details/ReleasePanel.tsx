import { useId, useState } from "react";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { detailsStyles as styles } from "./styles";
import { formatReleaseDate } from "../../lib/releaseDates";
import type { ReleaseData } from "../../lib/types";

type Props = {
  // what's out: "Vol. 25" or "Ch. 250"
  what: string;
  inJapan: boolean;
  // where they've got to: "vol. 24" or "ch. 203"
  yours: string | null;
  data: ReleaseData | null;
};

type Row = { what: string; when: string; estimate?: boolean };
type Group = { title: string; rows: Row[] };

// English: its chapters, since there are no English volume dates to go on.
// Japan: its volumes only, since MangaDex has translations and no Japanese
// chapters. The volume that's out already is the panel's headline
const groupsFrom = (data: ReleaseData | null, inJapan: boolean): Group[] => {
  const outNow: Row[] = [];
  const comingUp: Row[] = [];

  if (inJapan) {
    const next = data?.newVolume;
    const when = formatReleaseDate(next?.releaseDate);
    if (next?.volume && when) {
      comingUp.push({
        what: `Vol. ${next.volume}`,
        when,
        estimate: next.isEstimate,
      });
    }
  } else {
    const latest = data?.chapter?.latestReleased;
    const latestWhen = formatReleaseDate(latest?.releaseDate);
    if (latest?.chapterNumber && latestWhen) {
      outNow.push({
        what: `Ch. ${latest.chapterNumber}`,
        when: latestWhen,
      });
    }
    const next = data?.chapter?.estimateRelease;
    const nextWhen = formatReleaseDate(next?.releaseDate);
    if (next?.chapterNumber && nextWhen) {
      comingUp.push({
        what: `Ch. ${next.chapterNumber}`,
        when: nextWhen,
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
  what,
  inJapan,
  yours,
  data,
}: Props) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const groups = groupsFrom(data, inJapan);
  const headline = `${what} is out!`;
  const where = inJapan ? "Japan" : "English";
  const place = inJapan ? "in Japan" : "in English";
  const barText = (
    <>
      <span className={styles.releaseBarHeadline}>{headline}</span>
      <span className={styles.releaseBarOwned}>
        {place}
        {yours ? ` · ${yours}` : ""}
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
          {yours ? ` ${yours[0]!.toUpperCase()}${yours.slice(1)}.` : ""}
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
                      <span className={styles.releaseEstimate}>estimated</span>
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

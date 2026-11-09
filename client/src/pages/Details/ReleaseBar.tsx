import { useId, useState } from "react";
import { NavLink } from "react-router";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { detailsStyles as styles } from "./styles";
import { formatReleaseDate } from "../../lib/releaseDates";
import type { ReleaseData } from "../../lib/types";

type Props = {
  // what's out: "Vol. 25" or "Ch. 250"
  what: string;
  // which kind of release the headline is about, so the dates match it
  kind: "volume" | "chapter";
  inJapan: boolean;
  // where they've got to: "you own up to vol. 24" or "you're on ch. 203"
  yours: string | null;
  data: ReleaseData | null;
  // a volume that's for sale in English; there's nowhere to send a chapter
  buy: { to: string; label: string } | null;
};

type Row = { what: string; when: string; estimate?: boolean };
type Group = { title: string; rows: Row[] };

// the newest volume we have a date for
const newestDatedVolume = (data: ReleaseData | null): Row | null => {
  let newest: { volume: string; when: string } | null = null;
  for (const { volume, releaseDate } of data?.volume ?? []) {
    const when = formatReleaseDate(releaseDate);
    if (!volume || !when) continue;
    if (!newest || Number(volume) > Number(newest.volume)) {
      newest = { volume, when };
    }
  }
  return newest && { what: `Vol. ${newest.volume}`, when: newest.when };
};

// Dates that match the headline: a volume gets volumes, a chapter gets chapters.
// Volume dates are all Japan's: MangaDex has no English ones, so on an English
// volume the groups say so
const groupsFrom = (
  data: ReleaseData | null,
  kind: Props["kind"],
  inJapan: boolean,
  // the headline's volume ("Vol. 41" is out in English)
  headline: number,
): Group[] => {
  const outNow: Row[] = [];
  const comingUp: Row[] = [];
  // on an English volume the Japan lists are what's further on: never the
  // headline's own volume or one before it
  const beyond = (volume: string | undefined) =>
    inJapan || !Number.isFinite(headline) || Number(volume) > headline;

  if (kind === "volume") {
    const newest = newestDatedVolume(data);
    if (newest && beyond(newest.what.replace(/^Vol\. /, "")))
      outNow.push(newest);
    const next = data?.newVolume;
    const when = formatReleaseDate(next?.releaseDate);
    if (next?.volume && when && beyond(next.volume)) {
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

  const inJapanToo = kind === "volume" && !inJapan;
  return [
    // the English one is out (the bar's headline); these are further on, in
    // Japan only, so the heading mustn't read as if the headline's were
    { title: inJapanToo ? "Further ahead in Japan" : "Out now", rows: outNow },
    { title: inJapanToo ? "Next in Japan" : "Coming up", rows: comingUp },
  ].filter((group) => group.rows.length > 0);
};

// "there's a new one": a slim red bar that opens to the dates when clicked
// anywhere, except on its Buy link
export default function ReleaseBar({
  what,
  kind,
  inJapan,
  yours,
  data,
  buy,
}: Props) {
  const [open, setOpen] = useState(false);
  const datesId = useId();
  const groups = groupsFrom(
    data,
    kind,
    inJapan,
    // the number, not the "." in "Vol."
    Number(what.match(/\d+(?:\.\d+)?/)?.[0] ?? NaN),
  );
  const hasDates = groups.length > 0;
  const headline = (
    <span className={styles.releaseHeadline}>{what} is out!</span>
  );
  const yoursLine = yours ? `${yours[0]!.toUpperCase()}${yours.slice(1)}.` : "";
  const owned = (
    <span className={styles.releaseOwned}>
      {inJapan ? `In Japan. ${yoursLine}` : yoursLine || "In English."}
    </span>
  );

  return (
    <section
      className={styles.release}
      aria-label={`New release, ${inJapan ? "Japan" : "English"}`}
    >
      <div
        className={`${styles.releaseBar} ${hasDates ? styles.releaseBarOpens : ""}`}
        onClick={(e) => {
          if (hasDates && !(e.target as HTMLElement).closest("a"))
            setOpen(!open);
        }}
      >
        <span className={styles.releaseStamp} aria-hidden>
          Psst!
        </span>

        {/* the whole bar takes the click, which bubbles up from here; the button
            is what keyboards and screen readers use */}
        {hasDates ? (
          <button
            type="button"
            data-tour="release-toggle"
            className={styles.releaseToggle}
            aria-expanded={open}
            aria-controls={datesId}
          >
            {headline}
            {owned}
          </button>
        ) : (
          <p className={styles.releaseToggle}>
            {headline}
            {owned}
          </p>
        )}

        {buy && (
          <NavLink className={styles.releaseBuy} to={buy.to} viewTransition>
            {buy.label} →
          </NavLink>
        )}
        {hasDates && (
          <ChevronDownIcon
            className={`${styles.releaseChevron} ${open ? styles.releaseChevronOpen : ""}`}
            aria-hidden
          />
        )}
      </div>

      {hasDates && (
        <div
          id={datesId}
          className={styles.releaseDates}
          data-tour="release-dates"
          hidden={!open}
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

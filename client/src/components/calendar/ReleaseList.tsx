// What comes out, soonest first: the date written by hand (once for several
// on the same day), the cover, the series and volume, and a tick for one
// already on the shelf. Each opens its volume page; Add to calendar sits
// under the date, and Preorder goes straight to the stores on its page. A
// long month shows its first `limit`, the rest on asking
import { coverSet } from "../../lib/coverSizes";
import { useState } from "react";
import { NavLink } from "react-router";
import { CheckIcon } from "../icons/Icons";
import { dayName, type CalendarVolume } from "../../lib/collector";
import {
  coverSrc,
  hideBrokenCover,
  hidePlaceholderCover,
  volumePath,
} from "../../lib/prices";
import AddToCalendar from "./AddToCalendar";
import { rememberSpot, useWasShowingAll } from "../../lib/returnSpot";
import { calendarParts as styles } from "./styles";

// the volume's own cover over the series': one this far off rarely has its
// own yet, and a placeholder hides itself so the series' shows
export function VolumeCover({
  volume,
  big = false,
}: {
  volume: CalendarVolume;
  big?: boolean;
}) {
  return (
    <span className={big ? styles.coverRoomy : styles.cover} aria-hidden>
      {volume.seriesCover && (
        <img
          src={coverSrc(volume.seriesCover)}
          srcSet={coverSet(volume.seriesCover)}
          sizes="54px"
          alt=""
          loading="lazy"
          onError={hideBrokenCover}
        />
      )}
      {volume.coverUrl && (
        <img
          src={coverSrc(volume.coverUrl)}
          alt=""
          loading="lazy"
          onError={hideBrokenCover}
          onLoad={hidePlaceholderCover}
        />
      )}
    </span>
  );
}

// a short list beside a month's page gets room to breathe, so it reaches
// down the page beside it rather than leaving it standing alone
const ROOMY_UP_TO = 3;

export default function ReleaseList({
  volumes,
  limit,
  keep,
}: {
  volumes: CalendarVolume[];
  limit?: number;
  // which list this is, so Back from a release's page shows it as it was
  keep?: string;
}) {
  const [all, setAll] = useState(useWasShowingAll(keep));
  const shown = !limit || all ? volumes : volumes.slice(0, limit);
  const roomy = shown.length <= ROOMY_UP_TO;
  return (
    <>
      <ul
        className={styles.list}
        data-keep-all={keep && all ? keep : undefined}
      >
        {shown.map((v, i) => {
          const sameDay = i > 0 && shown[i - 1]!.published === v.published;
          return (
            <ReleaseRow
              key={v.isbn13}
              volume={v}
              when={sameDay ? "" : dayName(v.published)}
              roomy={roomy}
            />
          );
        })}
      </ul>
      {limit && volumes.length > limit && (
        <button
          type="button"
          className={styles.more}
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          {all ? "Show fewer" : `Show all ${volumes.length}`}
        </button>
      )}
    </>
  );
}

// one release
function ReleaseRow({
  volume: v,
  when,
  roomy,
}: {
  volume: CalendarVolume;
  // the day, written once for several on the same day
  when: string;
  roomy: boolean;
}) {
  const named = `${v.name}${v.volume !== null ? ` Vol. ${v.volume}` : ""}`;
  return (
    <li className={roomy ? `${styles.item} ${styles.itemRoomy}` : styles.item}>
      <div className={styles.when}>
        <span className={styles.hand}>{when}</span>
        <span className={styles.addSpot}>
          <AddToCalendar
            volumes={[v]}
            label={`Add ${named} to calendar`}
            fileName={`${v.name}${v.volume !== null ? ` Vol ${v.volume}` : ""}.ics`}
          />
        </span>
      </div>
      <NavLink
        to={volumePath(v.isbn13, v.title)}
        className={roomy ? styles.rowRoomy : styles.row}
        viewTransition
        // Back from its page comes back to the list as it was
        onClick={rememberSpot}
        aria-label={`${named}: out ${dayName(v.published)}${v.owned ? ", on your shelf" : ""}`}
      >
        <VolumeCover volume={v} big={roomy} />
        <span className={styles.text}>
          <span className={roomy ? styles.nameRoomy : styles.name}>
            {v.name}
          </span>
          <span className={styles.vol}>
            {v.volume !== null ? `Vol. ${v.volume}` : v.title}
          </span>
        </span>
        {v.owned && (
          <span className={styles.mine}>
            <CheckIcon className={styles.check} />
            preordered
          </span>
        )}
      </NavLink>
      {/* one on the shelf already has nothing to preorder */}
      {v.owned ? (
        <span />
      ) : (
        <div className={styles.preorderBox}>
          <NavLink
            // straight to the stores on its price page
            to={`${volumePath(v.isbn13, v.title)}#preorder`}
            className={styles.preorder}
            viewTransition
            aria-label={`Preorder ${named}`}
            // Back from there comes back to the list as it was
            onClick={rememberSpot}
          >
            Preorder
            <span className={styles.preorderArrow} aria-hidden>
              →
            </span>
          </NavLink>
        </div>
      )}
    </li>
  );
}

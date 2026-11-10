// What comes out, soonest first: the date written by hand (once for several
// on the same day), the cover, the series and volume, and a tick for one
// already on the shelf. Each opens its volume page. A long month shows its
// first `limit`, the rest on asking
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
}: {
  volumes: CalendarVolume[];
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = !limit || all ? volumes : volumes.slice(0, limit);
  const roomy = shown.length <= ROOMY_UP_TO;
  return (
    <>
      <ul className={styles.list}>
        {shown.map((v, i) => {
          const sameDay = i > 0 && shown[i - 1]!.published === v.published;
          const when = dayName(v.published);
          return (
            <li key={v.isbn13} className={styles.item}>
              <NavLink
                to={volumePath(v.isbn13, v.title)}
                className={roomy ? styles.rowRoomy : styles.row}
                viewTransition
                aria-label={`${v.name}${v.volume !== null ? `, volume ${v.volume}` : ""}: out ${when}${v.owned ? ", on your shelf" : ""}`}
              >
                <span className={styles.hand}>{sameDay ? "" : when}</span>
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
              <AddToCalendar
                volumes={[v]}
                label={`Add ${v.name}${v.volume !== null ? ` Vol. ${v.volume}` : ""} to calendar`}
                fileName={`${v.name}${v.volume !== null ? ` Vol ${v.volume}` : ""}.ics`}
              />
            </li>
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

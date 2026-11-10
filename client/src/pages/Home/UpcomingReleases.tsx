// "Upcoming Releases" at the top of the New tab: one bold panel, closed, with
// a peek at the next covers and when the next one's out. Opened, the month of
// the next release as a marked-up page with its list, and the way to the full
// calendar. Nothing at all when no volume of the shelf's series is dated
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { ChevronDownIcon } from "../../components/icons/Icons";
import MiniMonth from "../../components/calendar/MiniMonth";
import AddToCalendar from "../../components/calendar/AddToCalendar";
import ReleaseList, {
  VolumeCover,
} from "../../components/calendar/ReleaseList";
import {
  dayName,
  getCalendar,
  monthName,
  monthOnly,
  type CalendarMonth,
} from "../../lib/collector";
import { upcomingStyles as styles } from "./upcomingStyles";

// the panel lists at most this many from the month; the page has them all
const SHOWN = 6;

export default function UpcomingReleases() {
  const [months, setMonths] = useState<CalendarMonth[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getCalendar(controller.signal)
      .then(setMonths)
      .catch(() => {
        // switched off or unreachable: the New tab as it was
      });
    return () => controller.abort();
  }, []);

  const first = months?.[0];
  if (!first?.volumes.length) return null;
  const next = first.volumes[0]!;
  const count = first.volumes.length;
  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        <span className={styles.title}>Upcoming Releases</span>
        <span className={styles.peek}>
          {first.volumes.slice(0, 3).map((v, i) => (
            <span
              key={v.isbn13}
              className={styles.peekCover}
              style={{ rotate: `${[-4, 3, -2][i]}deg` }}
            >
              <VolumeCover volume={v} />
            </span>
          ))}
          <span className={styles.next}>
            Next: {dayName(next.published)} · {count} in{" "}
            {monthOnly(first.month)}
          </span>
        </span>
        <ChevronDownIcon className={styles.chevron} />
      </summary>
      <div className={styles.body}>
        {/* the month, with the way to the full calendar under it */}
        <div>
          <MiniMonth month={first.month} volumes={first.volumes} />
          <div className={styles.monthActions}>
            <AddToCalendar
              big
              volumes={first.volumes}
              label={`Save ${monthName(first.month)}'s release dates to your calendar`}
              fileName={`Manga releases ${monthName(first.month)}.ics`}
              text={`Save ${first.volumes.length > 1 ? `${first.volumes.length} dates` : "the date"}`}
            />
            {/* the panel lists SHOWN; the page has the rest and later months */}
            <NavLink to="/calendar" className={styles.all} viewTransition>
              Full calendar
            </NavLink>
          </div>
        </div>
        <div>
          <ReleaseList volumes={first.volumes.slice(0, SHOWN)} />
        </div>
      </div>
    </details>
  );
}

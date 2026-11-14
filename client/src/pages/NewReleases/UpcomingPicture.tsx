// A picture of Upcoming Releases, opened: the red bar at the top of the New
// tab, a volume on its way with its date, the month with that day ringed,
// and the two buttons under it. Drawn in the site's own shapes, like
// NewTabPicture: each part has its number in the margin beside it, and a
// line under the picture says what it is. The series in it is nobody's in
// particular, so its date is no real one.
import {
  CalendarPlusIcon,
  ChevronDownIcon,
} from "../../components/icons/Icons";
import { newReleasesStyles as styles } from "./styles";

const PARTS = [
  {
    name: "A volume on its way",
    body: "With the day it's out. Preorder opens its page, with the stores taking preorders.",
  },
  { name: "The month", body: "A day with a release is ringed." },
  {
    name: "Save the dates",
    body: "Puts them in your own calendar. Full calendar shows every month.",
  },
];

// the week the pictured volume comes out in
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEK = [6, 7, 8, 9, 10, 11, 12];
const OUT_ON = 12;

export default function UpcomingPicture() {
  return (
    <figure className={styles.figure}>
      <div
        className={styles.picture}
        role="img"
        aria-label="Upcoming Releases, opened: a volume due on December 12 with a Preorder link, the month with the 12th ringed, and buttons to save the dates and open the full calendar"
      >
        <div className={styles.picUpcoming}>
          <b>Upcoming Releases</b>
          <span>Next: Dec {OUT_ON}</span>
          <ChevronDownIcon className="ml-auto size-4 rotate-180" aria-hidden />
        </div>

        <div className={styles.picPart}>
          <span className={styles.dot}>1</span>
          <div className={styles.picRow}>
            <span className={styles.picBook}>16</span>
            <span className={styles.picWords}>
              <span className={styles.upDate}>Dec {OUT_ON}</span>
              <b>Vol. 16</b>
            </span>
            <span className={styles.upPreorder}>Preorder →</span>
          </div>
        </div>

        <div className={styles.picPart}>
          <span className={styles.dot}>2</span>
          <div className={styles.upMonth}>
            <span className={styles.upMonthHead}>
              <b>December</b>
              <small>1 release</small>
            </span>
            <span className={styles.upDays}>
              {DAYS.map((day, i) => (
                <span key={i}>{day}</span>
              ))}
            </span>
            <span className={styles.upWeek}>
              {WEEK.map((day) => (
                <span
                  key={day}
                  className={day === OUT_ON ? styles.upDayOut : undefined}
                >
                  {day}
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className={styles.picPart}>
          <span className={styles.dot}>3</span>
          <div className={styles.upButtons}>
            <span>
              <CalendarPlusIcon className="size-4" aria-hidden />
              Save 1 date
            </span>
            <span>Full calendar</span>
          </div>
        </div>
      </div>

      {/* role: Safari stops announcing a list once its bullets are styled away */}
      <ol role="list" className={styles.parts}>
        {PARTS.map((part, i) => (
          <li key={part.name} className={styles.part}>
            <span className={styles.dot}>{i + 1}</span>
            <p>
              <b>{part.name}.</b> {part.body}
            </p>
          </li>
        ))}
      </ol>
    </figure>
  );
}

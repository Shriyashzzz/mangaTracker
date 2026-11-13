// A small month page with the release days circled in red marker.
// Decorative: the list beside it says the same in words, so screen readers
// get that instead
import {
  monthDays,
  monthName,
  todayIso,
  type CalendarVolume,
} from "../../lib/collector";
import { calendarParts as styles } from "./styles";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function MiniMonth({
  month,
  volumes,
}: {
  // "2026-12"
  month: string;
  volumes: CalendarVolume[];
}) {
  const today = todayIso();
  const byDay = new Map<string, CalendarVolume[]>();
  for (const v of volumes)
    byDay.set(v.published, [...(byDay.get(v.published) ?? []), v]);
  return (
    <div className={styles.month} aria-hidden>
      <header>
        <b className={styles.monthName}>{monthName(month)}</b>
        <span className={styles.monthCount}>
          {volumes.length} {volumes.length === 1 ? "release" : "releases"}
        </span>
      </header>
      <div className={styles.grid}>
        {DOW.map((d, i) => (
          <span key={i} className={styles.dow}>
            {d}
          </span>
        ))}
        {monthDays(month).map((d) => {
          const out = d.inMonth ? (byDay.get(d.iso) ?? []) : [];
          return (
            <span
              key={d.iso}
              className={d.inMonth ? styles.day : styles.dayOut}
            >
              <span
                className={[
                  d.iso === today && styles.today,
                  out.length > 0 && styles.release,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {d.day}
              </span>
              {out.length > 0 && (
                <svg viewBox="0 0 40 40" className={styles.circle}>
                  <path
                    d="M20 4c9 0 16 6 16 15s-7 17-17 17S3 29 4 19 11 5 22 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

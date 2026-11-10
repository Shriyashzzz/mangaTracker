// /calendar: the volumes still to come for series on the shelf, month by
// month, from the release dates the catalog lists (Google Books): each month
// its marked-up page (the New tab panel's, kept going) beside its list. Each
// volume opens its page, where it can be preordered. Opened from the New tab's
// "Upcoming Releases".
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { ChevronDownIcon } from "../../components/icons/Icons";
import MiniMonth from "../../components/calendar/MiniMonth";
import ReleaseList from "../../components/calendar/ReleaseList";
import Mascot from "../../components/mascot/Mascot";
import { signInPath } from "../../lib/api";
import {
  getCalendar,
  monthName,
  type CalendarMonth,
} from "../../lib/collector";
import { usePrivatePage } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { calendarStyles as styles } from "./styles";

// months shown open; later ones fold, so a big shelf's year stays a page
const OPEN_MONTHS = 2;
// a busy month lists this many, the rest on asking
const MONTH_LIMIT = 8;

// a month: its marked-up page beside its list
function Month({ month }: { month: CalendarMonth }) {
  return (
    <div className={styles.monthBody}>
      <MiniMonth month={month.month} volumes={month.volumes} />
      <div>
        <ReleaseList volumes={month.volumes} limit={MONTH_LIMIT} />
      </div>
    </div>
  );
}

export default function CalendarPage() {
  usePrivatePage("Release calendar");
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const navigate = useNavigate();
  // undefined while asking; null when it couldn't be had
  const [months, setMonths] = useState<CalendarMonth[] | null | undefined>();

  useEffect(() => {
    if (isSignedIn === false) {
      navigate(signInPath("/calendar"), { replace: true });
      return;
    }
    if (!isSignedIn) return;
    const controller = new AbortController();
    getCalendar(controller.signal)
      .then(setMonths)
      .catch(() => {
        if (!controller.signal.aborted) setMonths(null);
      });
    return () => controller.abort();
  }, [isSignedIn, navigate]);

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          Coming <span className={styles.hit}>out</span>
        </h1>
        <NavLink to="/shelf?tab=new" className={styles.back} viewTransition>
          Back to New
        </NavLink>
      </header>
      <p className={styles.lead}>
        English volumes on their way for series on your shelf, by the date the
        publisher gives.
      </p>

      {months === undefined && (
        <div className={`skeleton ${styles.loading}`} aria-busy="true">
          <span className="sr-only">Finding release dates…</span>
        </div>
      )}
      {months === null && (
        <p className={styles.note} role="alert">
          Couldn't get the release dates right now. Try again in a moment.
        </p>
      )}
      {months?.length === 0 && (
        <div className={styles.empty}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={styles.emptyTitle}>Nothing dated yet.</p>
          <p className={styles.emptyBody}>
            Dates show up once a publisher lists a coming volume. Opening a
            series' price page brings its list up to date.
          </p>
        </div>
      )}
      {months?.map((m, i) =>
        // the next two months open; the ones after folded, with their count
        i < OPEN_MONTHS ? (
          <section
            key={m.month}
            className={styles.month}
            aria-label={monthName(m.month)}
          >
            <Month month={m} />
          </section>
        ) : (
          <details key={m.month} className={styles.folded}>
            <summary className={styles.foldedSummary}>
              <span className={styles.foldedName}>{monthName(m.month)}</span>
              <span className={styles.foldedCount}>
                {m.volumes.length} coming
              </span>
              <ChevronDownIcon className={styles.chevron} />
            </summary>
            <Month month={m} />
          </details>
        ),
      )}
    </article>
  );
}

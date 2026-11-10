// /calendar: the volumes still to come for series on the shelf, month by
// month, from the release dates the catalog lists (Google Books). Each opens
// its volume page, where it can be preordered. Opened from the New tab.
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { CheckIcon } from "../../components/icons/Icons";
import Mascot from "../../components/mascot/Mascot";
import { signInPath } from "../../lib/api";
import {
  dayName,
  getCalendar,
  monthName,
  type CalendarMonth,
} from "../../lib/collector";
import {
  coverSrc,
  hideBrokenCover,
  hidePlaceholderCover,
  volumePath,
} from "../../lib/prices";
import { usePrivatePage } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { calendarStyles as styles } from "./styles";

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
      {months?.map((m) => (
        <section
          key={m.month}
          className={styles.month}
          aria-labelledby={`month-${m.month}`}
        >
          <h2 id={`month-${m.month}`} className={styles.monthName}>
            {monthName(m.month)}
          </h2>
          <ul className={styles.list}>
            {m.volumes.map((v) => (
              <li key={v.isbn13} className={styles.item}>
                <NavLink
                  to={volumePath(v.isbn13, v.title)}
                  className={styles.row}
                  viewTransition
                >
                  <span className={styles.date}>{dayName(v.published)}</span>
                  <span className={styles.thumb} aria-hidden>
                    {/* the series' cover underneath; the volume's own on top,
                        where it has one (one this far off rarely does: a
                        placeholder hides itself and the series' shows) */}
                    {v.seriesCover && (
                      <img
                        src={coverSrc(v.seriesCover)}
                        alt=""
                        loading="lazy"
                        onError={hideBrokenCover}
                      />
                    )}
                    {v.coverUrl && (
                      <img
                        src={coverSrc(v.coverUrl)}
                        alt=""
                        loading="lazy"
                        className={styles.ownCover}
                        onError={hideBrokenCover}
                        onLoad={hidePlaceholderCover}
                      />
                    )}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{v.name}</span>
                    <span className={styles.vol}>
                      {v.volume !== null ? `Vol. ${v.volume}` : v.title}
                    </span>
                  </span>
                  {v.owned && (
                    <span className={styles.owned}>
                      <CheckIcon className={styles.check} />
                      On your shelf
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

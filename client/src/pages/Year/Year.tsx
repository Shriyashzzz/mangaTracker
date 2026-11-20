// Your year in manga: the year added up from the shelf's history (server
// history/yearRules.ts) as manga panels. An inked opening, the title the
// year gives them, then one card per number in the stamp inks, Kenji
// reacting on each, the covers of what was read most and rated highest, the
// year's highlights, and the picture to post last (yearPicture.ts).
//
// A laptop sees them as a comic page, two to a row. A phone swipes through
// them like stories, one card at a time with dots under them: the page is a
// screen, not eight. Cards with nothing in them are left out; a year with
// nothing yet says how it fills in.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useParams } from "react-router";
import SeriesPicture from "../../components/cover/SeriesPicture";
import Mascot from "../../components/mascot/Mascot";
import { getJson } from "../../lib/api";
import { orOffline } from "../../lib/offline";
import { handPicture } from "../../lib/picture";
import { formatCents } from "../../lib/prices";
import { usePrivatePage } from "../../lib/seo";
import {
  counted,
  dayText,
  emptyYear,
  kenjiSays,
  many,
  monthName,
  shelfLength,
  sinceText,
  type YearInManga,
  yearSeason,
} from "../../lib/year";
import { drawYearPicture } from "./yearPicture";
import { yearStyles as styles } from "./styles";

// the stamp inks the cards take in turn, as the light theme has them
// (index.css --stamp-*): a card is a printed page in every theme, so Kenji
// and his bubble read on it in dark mode too
const INKS = ["#f8d46b", "#bfe6c8", "#cdd6fb", "#f2c9bf"];

function Card({
  ink,
  wide = false,
  children,
}: {
  ink: number;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={wide ? styles.cardWide : styles.card}
      style={{ background: INKS[ink % INKS.length] }}
      data-tilt={ink % 2 ? "right" : "left"}
      data-card
    >
      {children}
    </section>
  );
}

// Kenji, small, with what he makes of it in a speech bubble
function Kenji({ says }: { says: string }) {
  return (
    <p className={styles.kenji}>
      <span className={styles.kenjiFace} aria-hidden>
        <Mascot mood="happy" />
      </span>
      <span className={styles.bubble}>{says}</span>
    </p>
  );
}

// covers fanned like books dropped on a table
function Covers({
  series,
}: {
  series: { name: string; image: string | null }[];
}) {
  return (
    <div className={styles.covers} aria-hidden>
      {series.slice(0, 3).map((s) => (
        <span key={s.name} className={styles.cover}>
          <SeriesPicture name={s.name} url={s.image} sizes="96px" />
        </span>
      ))}
    </div>
  );
}

function ShareCard({ year, ink }: { year: YearInManga; ink: number }) {
  const [state, setState] = useState<"" | "making" | "failed">("");
  const share = async () => {
    setState("making");
    const blob = await drawYearPicture(year).catch(() => null);
    if (!blob) return setState("failed");
    await handPicture(blob, `my-${year.year}-in-manga.png`);
    setState("");
  };
  return (
    <Card ink={ink} wide>
      <h2 className={styles.heading}>Post your year</h2>
      <p className={styles.small}>
        Your year as a manga magazine cover, sized for a story.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={state === "making"}
          onClick={share}
        >
          {state === "making" ? "Making it…" : "Share my year"}
        </button>
        {state === "failed" && (
          <span className="font-medium" role="alert">
            Couldn't make the picture. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}

// the dots under a phone's cards: which one is showing
function Dots({ count, at }: { count: number; at: number }) {
  return (
    <div className={styles.dots} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={styles.dot} data-on={i === at || undefined} />
      ))}
    </div>
  );
}

export default function Year() {
  const params = useParams();
  const [year, setYear] = useState<YearInManga | null>(null);
  const [failed, setFailed] = useState("");
  const [showing, setShowing] = useState(0);
  const [cards, setCards] = useState(0);
  const deck = useRef<HTMLDivElement>(null);
  usePrivatePage("Your year in manga");

  // out of season (lib/year.ts yearSeason): not shown, whatever the link
  const season = yearSeason();

  useEffect(() => {
    if (season === null) return;
    const which = params.year ?? String(season);
    getJson<YearInManga>(`/api/history/year?year=${encodeURIComponent(which)}`)
      .then(setYear)
      .catch(() => setFailed(orOffline("Your year didn't load. Try again.")));
  }, [params.year, season]);

  // on a phone the cards scroll sideways: which one is in view
  useEffect(() => {
    const row = deck.current;
    if (!row) return;
    const all = row.querySelectorAll("[data-card]");
    setCards(all.length);
    const look = () => {
      const step = (all[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
      setShowing(Math.round(row.scrollLeft / step));
    };
    row.addEventListener("scroll", look, { passive: true });
    return () => row.removeEventListener("scroll", look);
  }, [year]);

  if (season === null)
    return (
      <p className={`${styles.page} py-16 text-ink-soft`}>
        Your year in manga comes back on Nov 25.{" "}
        <NavLink to="/" className="underline underline-offset-3" viewTransition>
          Back to your shelf
        </NavLink>
      </p>
    );
  if (failed)
    return <p className={`${styles.page} py-16 text-accent`}>{failed}</p>;
  if (!year) return <div className="min-h-[70dvh]" aria-busy />;

  const since = sinceText(year);
  // each card takes the next ink, whichever are shown
  let ink = 0;
  const next = () => ink++;
  const read = year.chaptersRead > 0 || year.volumesRead > 0;
  const spent = year.booksBought > 0 && year.spentCents > 0;
  const length = shelfLength(year.shelf.volumes);
  const highlights = [
    year.biggestDay && {
      label: "Biggest day",
      text: `${dayText(year.biggestDay.day)}: ${many(year.biggestDay.chapters, "chapter")}, mostly ${year.biggestDay.series}`,
    },
    year.longestStreak > 1 && {
      label: "Longest streak",
      text: `${year.longestStreak} days in a row`,
    },
    year.firstVolume && {
      label: "First volume of the year",
      text: `${year.firstVolume.series} vol. ${year.firstVolume.volume}, ${dayText(year.firstVolume.day)}`,
    },
    year.lastFinished && {
      label: "Last one you finished",
      text: `${year.lastFinished.series}, ${dayText(year.lastFinished.day)}`,
    },
  ].filter((h): h is { label: string; text: string } => Boolean(h));

  return (
    <article className={`${styles.page} fade-in`}>
      <section className={styles.opening}>
        <span className="printed mascot-spot m-0! shrink-0" aria-hidden>
          <Mascot mood="happy" />
        </span>
        <div>
          <h1 className={styles.title}>
            Your {year.year}
            <br />
            <span className={styles.titleHit}>in manga</span>
          </h1>
          {since && (
            <p className={styles.openingSmall}>
              {since}, when your history began.
            </p>
          )}
        </div>
      </section>

      <div className={styles.grid} ref={deck}>
        {emptyYear(year) ? (
          <Card ink={next()} wide>
            <h2 className={styles.heading}>It fills in as you go</h2>
            <ul className={`${styles.small} mt-2 list-disc pl-5`}>
              <li>Tick the volumes you buy.</li>
              <li>Move your place as you read.</li>
              <li>Mark a series finished.</li>
            </ul>
            <NavLink to="/shelf" className="btn btn-primary mt-4 self-start">
              To your shelf
            </NavLink>
          </Card>
        ) : (
          <>
            {/* who the year says they are: the headline of the page */}
            <section className={styles.titleCard} data-card>
              <p className={styles.titleKicker}>This year you were</p>
              <h2 className={styles.titleName}>{year.title.name}</h2>
              <p className={styles.titleLine}>{year.title.line}</p>
            </section>
            {year.volumesAdded > 0 && (
              <Card ink={next()}>
                <Kenji says={kenjiSays.volumes(year.volumesAdded)} />
                <p className={styles.big}>+{counted(year.volumesAdded)}</p>
                <p className={styles.say}>
                  {year.volumesAdded === 1 ? "volume" : "volumes"} added to your
                  shelf
                </p>
                {year.seriesAdded > 0 && (
                  <p className={styles.small}>
                    Including{" "}
                    {many(year.seriesAdded, "new series", "new series")}.
                  </p>
                )}
              </Card>
            )}
            {read && (
              <Card ink={next()}>
                {year.topSeries.length > 0 ? (
                  <Covers series={year.topSeries} />
                ) : (
                  <Kenji says={kenjiSays.chapters(year.chaptersRead)} />
                )}
                <p className={styles.big}>
                  {counted(year.chaptersRead || year.volumesRead)}
                </p>
                <p className={styles.say}>
                  {year.chaptersRead
                    ? `${year.chaptersRead === 1 ? "chapter" : "chapters"} read`
                    : `${year.volumesRead === 1 ? "volume" : "volumes"} read`}
                </p>
                {year.chaptersRead > 0 && year.volumesRead > 0 && (
                  <p className={styles.small}>
                    And {many(year.volumesRead, "volume")} read.
                  </p>
                )}
                {year.topSeries.length > 0 && (
                  <p className={styles.small}>
                    Read most:{" "}
                    <strong>
                      {year.topSeries.map((t) => t.name).join(", ")}
                    </strong>
                  </p>
                )}
              </Card>
            )}
            {year.seriesFinished > 0 && (
              <Card ink={next()}>
                <Kenji says={kenjiSays.finished(year.seriesFinished)} />
                <p className={styles.big}>{counted(year.seriesFinished)}</p>
                <p className={styles.say}>series finished</p>
              </Card>
            )}
            {spent && (
              <Card ink={next()}>
                <Kenji says={kenjiSays.spent()} />
                <p className={styles.big}>{formatCents(year.spentCents)}</p>
                <p className={styles.say}>
                  spent on {many(year.booksBought, "book")}
                </p>
                <p className={styles.small}>From what you entered as paid.</p>
              </Card>
            )}
            {highlights.length > 0 && (
              <Card ink={next()}>
                <h2 className={styles.heading}>Highlights</h2>
                <dl className={styles.highlights}>
                  {highlights.map((h) => (
                    <div key={h.label}>
                      <dt className={styles.highlightLabel}>{h.label}</dt>
                      <dd className={styles.highlightText}>{h.text}</dd>
                    </div>
                  ))}
                  {year.busiestMonth && (
                    <div>
                      <dt className={styles.highlightLabel}>Busiest month</dt>
                      <dd className={styles.highlightText}>
                        {monthName(year.busiestMonth)}
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            )}
          </>
        )}

        <Card ink={next()}>
          {year.shelf.fiveStars.length > 0 ? (
            <Covers series={year.shelf.fiveStars} />
          ) : (
            <Kenji says={kenjiSays.shelf()} />
          )}
          <h2 className={styles.heading}>Your shelf now</h2>
          <p className={styles.say}>
            {many(year.shelf.series, "series", "series")} ·{" "}
            {many(year.shelf.volumes, "volume")}
          </p>
          {length && (
            <p className={styles.small}>
              About {length.metres} m of spines: {length.picture}.
            </p>
          )}
          {year.shelf.topGenre && (
            <p className={styles.small}>Mostly {year.shelf.topGenre}.</p>
          )}
          {year.shelf.fiveStars.length > 0 && (
            <p className={styles.small}>
              Five stars:{" "}
              <strong>
                {year.shelf.fiveStars.map((s) => s.name).join(", ")}
              </strong>
            </p>
          )}
        </Card>

        {!emptyYear(year) && <ShareCard year={year} ink={next()} />}
      </div>
      {cards > 1 && <Dots count={cards} at={showing} />}
    </article>
  );
}

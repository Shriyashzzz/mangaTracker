// Your year in manga: the year added up from the shelf's history (server
// history/yearRules.ts) as a page of manga panels: an inked opening panel,
// then one card per number, each in a stamp ink, the covers of what was
// read most and rated highest fanned on theirs, and the picture to post
// last (yearPicture.ts). Two to a row on a laptop, one on a phone. Cards
// with nothing in them are left out; a year with nothing yet says how it
// fills in.
import { useEffect, useState, type ReactNode } from "react";
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
  emptyYear,
  many,
  monthName,
  sinceText,
  type YearInManga,
} from "../../lib/year";
import { drawYearPicture } from "./yearPicture";
import { yearStyles as styles } from "./styles";

// the stamp inks the cards take in turn (index.css --stamp-*)
const INKS = [
  "var(--stamp-market)",
  "var(--stamp-new)",
  "var(--stamp-ebook)",
  "var(--stamp-get)",
];

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
    >
      {children}
    </section>
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
  // the last card, across the page: it closes the page, not a half row
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
      <p className={styles.small}>One picture of it, sized for a story.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={state === "making"}
          onClick={share}
        >
          {state === "making" ? "Making it…" : "Share my year"}
        </button>
        {state === "failed" && (
          <span className="font-medium text-[var(--accent-ink)]" role="alert">
            Couldn't make the picture. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}

export default function Year() {
  const params = useParams();
  const [year, setYear] = useState<YearInManga | null>(null);
  const [failed, setFailed] = useState("");
  usePrivatePage("Your year in manga");

  useEffect(() => {
    const asked = params.year ? `?year=${encodeURIComponent(params.year)}` : "";
    getJson<YearInManga>(`/api/history/year${asked}`)
      .then(setYear)
      .catch(() => setFailed(orOffline("Your year didn't load. Try again.")));
  }, [params.year]);

  if (failed)
    return <p className={`${styles.page} py-16 text-accent`}>{failed}</p>;
  if (!year) return <div className="min-h-[70dvh]" aria-busy />;

  const since = sinceText(year);
  // each card takes the next ink, whichever are shown
  let ink = 0;
  const next = () => ink++;
  const read = year.chaptersRead > 0 || year.volumesRead > 0;
  const spent = year.booksBought > 0 && year.spentCents > 0;

  return (
    <article className={`${styles.page} fade-in`}>
      <div className={styles.grid}>
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
            {year.volumesAdded > 0 && (
              <Card ink={next()}>
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
                {year.topSeries.length > 0 && (
                  <Covers series={year.topSeries} />
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
                <p className={styles.big}>{counted(year.seriesFinished)}</p>
                <p className={styles.say}>series finished</p>
              </Card>
            )}
            {spent && (
              <Card ink={next()}>
                <p className={styles.big}>{formatCents(year.spentCents)}</p>
                <p className={styles.say}>
                  spent on {many(year.booksBought, "book")}
                </p>
                <p className={styles.small}>From what you entered as paid.</p>
              </Card>
            )}
            {year.busiestMonth && (
              <Card ink={next()}>
                <p className={styles.big}>{monthName(year.busiestMonth)}</p>
                <p className={styles.say}>was your busiest month</p>
              </Card>
            )}
          </>
        )}

        <Card ink={next()}>
          {year.shelf.fiveStars.length > 0 && (
            <Covers series={year.shelf.fiveStars} />
          )}
          <h2 className={styles.heading}>Your shelf now</h2>
          <p className={styles.say}>
            {many(year.shelf.series, "series", "series")} ·{" "}
            {many(year.shelf.volumes, "volume")}
          </p>
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
    </article>
  );
}

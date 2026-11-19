// Your year in manga: the year added up from the shelf's history (server
// history/yearRules.ts), one big number to a panel, scrolled through, and
// a picture of it to post at the end (yearPicture.ts). Panels with nothing
// in them are left out; a year with nothing yet says how it fills in.
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useParams } from "react-router";
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

const panel =
  "fade-in mx-auto flex min-h-[70dvh] max-w-[760px] flex-col justify-center gap-3 border-b-[3px] border-double border-line py-16";
const big =
  "font-brand text-[clamp(5rem,22vw,10rem)] leading-[0.9] tracking-[0.02em]";
const say = "text-[clamp(1.2rem,4vw,1.6rem)] font-medium text-accent-ink";
const small = "text-[1.05rem] leading-[1.5] text-ink-soft";

function Panel({ children }: { children: ReactNode }) {
  return <section className={panel}>{children}</section>;
}

function SharePanel({ year }: { year: YearInManga }) {
  const [state, setState] = useState<"" | "making" | "failed">("");
  const share = async () => {
    setState("making");
    const blob = await drawYearPicture(year).catch(() => null);
    if (!blob) return setState("failed");
    await handPicture(blob, `my-${year.year}-in-manga.png`);
    setState("");
  };
  return (
    <Panel>
      <h2 className="font-brand text-[clamp(2.4rem,8vw,4rem)] leading-none uppercase">
        Post your year
      </h2>
      <p className={small}>One picture of it, sized for a story.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={state === "making"}
          onClick={share}
        >
          {state === "making" ? "Making it…" : "Share my year"}
        </button>
        {state === "failed" && (
          <span className="font-medium text-accent" role="alert">
            Couldn't make the picture. Try again.
          </span>
        )}
      </div>
    </Panel>
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
    return (
      <p className="px-gutter mx-auto max-w-[760px] py-16 text-accent">
        {failed}
      </p>
    );
  if (!year) return <div className="min-h-[70dvh]" aria-busy />;

  const since = sinceText(year);
  const top = year.topSeries;
  return (
    <article className="px-gutter">
      <Panel>
        <span className="printed mascot-spot self-start" aria-hidden>
          <Mascot mood="happy" />
        </span>
        <h1 className="font-brand text-[clamp(3rem,12vw,6rem)] leading-[0.95] uppercase">
          Your {year.year}
          <br />
          <span className="inline-block -rotate-2 bg-ink px-4 text-paper shadow-[8px_8px_0_var(--accent)]">
            in manga
          </span>
        </h1>
        {since && <p className={small}>{since}, when your history began.</p>}
      </Panel>

      {emptyYear(year) ? (
        <Panel>
          <h2 className="font-brand text-[clamp(2.4rem,8vw,4rem)] leading-none uppercase">
            It fills in as you go
          </h2>
          <ul className={`${small} list-disc pl-5`}>
            <li>Tick the volumes you buy.</li>
            <li>Move your place as you read.</li>
            <li>Mark a series finished.</li>
          </ul>
          <NavLink to="/shelf" className="btn btn-primary mt-3 self-start">
            To your shelf
          </NavLink>
        </Panel>
      ) : (
        <>
          {year.volumesAdded > 0 && (
            <Panel>
              <p className={big}>+{counted(year.volumesAdded)}</p>
              <p className={say}>
                {year.volumesAdded === 1 ? "volume" : "volumes"} added to your
                shelf
              </p>
              {year.seriesAdded > 0 && (
                <p className={small}>
                  Including {many(year.seriesAdded, "new series", "new series")}
                  .
                </p>
              )}
            </Panel>
          )}
          {(year.chaptersRead > 0 || year.volumesRead > 0) && (
            <Panel>
              {year.chaptersRead > 0 && (
                <>
                  <p className={big}>{counted(year.chaptersRead)}</p>
                  <p className={say}>
                    {year.chaptersRead === 1 ? "chapter" : "chapters"} read
                  </p>
                </>
              )}
              {year.volumesRead > 0 && (
                <p className={year.chaptersRead ? small : say}>
                  {year.chaptersRead
                    ? `And ${many(year.volumesRead, "volume")} read.`
                    : `${many(year.volumesRead, "volume")} read`}
                </p>
              )}
              {top.length > 0 && (
                <p className={small}>
                  Read most:{" "}
                  <strong>{top.map((t) => t.name).join(", ")}</strong>
                </p>
              )}
            </Panel>
          )}
          {year.seriesFinished > 0 && (
            <Panel>
              <p className={big}>{counted(year.seriesFinished)}</p>
              <p className={say}>
                {year.seriesFinished === 1 ? "series" : "series"} finished
              </p>
            </Panel>
          )}
          {year.booksBought > 0 && year.spentCents > 0 && (
            <Panel>
              <p className={big}>{formatCents(year.spentCents)}</p>
              <p className={say}>spent on {many(year.booksBought, "book")}</p>
              <p className={small}>From what you entered as paid.</p>
            </Panel>
          )}
          {year.busiestMonth && (
            <Panel>
              <p className={big}>{monthName(year.busiestMonth)}</p>
              <p className={say}>was your busiest month</p>
            </Panel>
          )}
        </>
      )}

      <Panel>
        <h2 className="font-brand text-[clamp(2.4rem,8vw,4rem)] leading-none uppercase">
          Your shelf now
        </h2>
        <p className={say}>
          {many(year.shelf.series, "series", "series")} ·{" "}
          {many(year.shelf.volumes, "volume")}
        </p>
        {year.shelf.topGenre && (
          <p className={small}>Mostly {year.shelf.topGenre}.</p>
        )}
        {year.shelf.fiveStars.length > 0 && (
          <p className={small}>
            Five stars: <strong>{year.shelf.fiveStars.join(", ")}</strong>
          </p>
        )}
      </Panel>

      {!emptyYear(year) && <SharePanel year={year} />}
    </article>
  );
}

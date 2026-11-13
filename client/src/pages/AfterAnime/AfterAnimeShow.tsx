// /after-the-anime/:slug  "Where does the X anime leave off?" One panel per
// season: the chapter to start at and the volumes to get, with prices. The
// seasons come from /api/after-anime; the volumes and prices from the same
// series list the price page uses.
import { showMeta } from "../../lib/afterAnimeText";
import { useEffect, useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import {
  AFTER_ANIME_PATH,
  getAfterAnime,
  type AfterAnime,
} from "../../lib/afterAnime";
import { HttpError } from "../../lib/api";
import { seriesCanonicalPath, timeAgo } from "../../lib/prices";
import { usePageMeta } from "../../lib/seo";
import { pricesStyles as priceStyles } from "../Prices/styles";
import { useSeriesLoad } from "../Prices/useSeriesData";
import FixForm from "./FixForm";
import SeasonPanel from "./SeasonPanel";
import { afterAnimeStyles as styles } from "./styles";

// the seasons of one series. `asked` names the series an answer is for, so
// another series' answer is never shown
function useAfterAnime(name: string) {
  const [state, setState] = useState<{
    asked: string;
    show: AfterAnime | null;
    // "missing": we don't know the series; "failed": it couldn't be asked
    problem: "" | "missing" | "failed";
  }>({ asked: "", show: null, problem: "" });

  useEffect(() => {
    const controller = new AbortController();
    getAfterAnime(name, controller.signal)
      .then((show) => setState({ asked: name, show, problem: "" }))
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        const missing = e instanceof HttpError && e.status === 404;
        setState({
          asked: name,
          show: null,
          problem: missing ? "missing" : "failed",
        });
      });
    return () => controller.abort();
  }, [name]);

  const answered = state.asked === name;
  return {
    loading: !answered,
    show: answered ? state.show : null,
    problem: answered ? state.problem : "",
  };
}

export default function AfterAnimeShow() {
  // the route always has a :slug
  const slug = useParams().slug!;
  const [params] = useSearchParams();
  // the link carries the real name; a bare slug still finds a series we know
  const asked = params.get("name") ?? slug.replace(/-/g, " ");
  const { loading, show, problem } = useAfterAnime(asked);
  // its English volumes and their prices, once we know its real name
  const series = useSeriesLoad(show?.name ?? "");
  const volumes = show && !series.loading ? (series.data?.volumes ?? []) : null;

  usePageMeta(showMeta(show, problem !== ""));

  const name = show?.name ?? asked;
  return (
    <div className={`${styles.page} fade-in`}>
      <nav className={priceStyles.crumbs} aria-label="Breadcrumb">
        <NavLink to={AFTER_ANIME_PATH} className="tap" viewTransition>
          After the anime
        </NavLink>
        <span aria-hidden>/</span>
        <span aria-current="page">{name}</span>
      </nav>

      <header className={styles.head}>
        <h1 className={styles.title}>
          Where does the <span className={styles.named}>{name}</span> anime
          leave off?
        </h1>
        {show && show.stops.length > 0 && (
          <p className={styles.sub}>
            Find the last season you watched. It says which chapter of the manga
            to start at, and which volume that's in.
          </p>
        )}
      </header>

      {loading && (
        <div className={styles.seasons} aria-busy="true" aria-label="Loading">
          <div className={`skeleton h-56`} />
          <div className={`skeleton h-56`} />
        </div>
      )}

      {problem !== "" && (
        <div className={priceStyles.empty} role="alert">
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood={problem === "missing" ? "confused" : "panic"} />
          </span>
          <p className={priceStyles.emptyTitle}>
            {problem === "missing"
              ? "We don't know that series."
              : "That didn't load."}
          </p>
          <p>
            {problem === "missing"
              ? "Check the spelling, or look it up by name."
              : "Try again in a moment."}
          </p>
          <div className={priceStyles.emptyActions}>
            <NavLink to={AFTER_ANIME_PATH} className="btn" viewTransition>
              Search shows
            </NavLink>
          </div>
        </div>
      )}

      {show && show.stops.length === 0 && (
        <section className={styles.season}>
          <div className={styles.seasonWords}>
            <h2 className={styles.seasonTitle}>No answer yet</h2>
            <p className={styles.end}>
              Either {show.name} has no anime, or nobody has written down where
              it stops. If you know, tell us and it goes up once it's checked.
            </p>
            <NavLink
              to={seriesCanonicalPath(show.name)}
              className={styles.link}
              viewTransition
            >
              Every volume of {show.name} and its price
            </NavLink>
          </div>
          <FixForm seriesName={show.name} season={null} open />
        </section>
      )}

      {show && show.stops.length > 0 && (
        <>
          <div className={styles.seasons}>
            {show.stops.map((stop) => (
              <SeasonPanel
                key={stop.label}
                stop={stop}
                seriesName={show.name}
                seriesCoverUrl={show.coverUrl}
                volumes={volumes}
              />
            ))}
          </div>
          <div className={styles.more}>
            <NavLink
              to={seriesCanonicalPath(show.name)}
              className="btn btn-primary"
              viewTransition
            >
              Every volume and its price
            </NavLink>
            <NavLink to={AFTER_ANIME_PATH} className="btn" viewTransition>
              Look up another show
            </NavLink>
          </div>
          <p className={styles.credit}>
            {show.sourceUrl ? (
              <>
                Where each season ends comes from{" "}
                <a href={show.sourceUrl} target="_blank" rel="noreferrer">
                  MangaUpdates
                </a>
                {show.checkedAt && `, checked ${timeAgo(show.checkedAt)}`}.{" "}
              </>
            ) : (
              "Where each season ends was sent in by a reader and checked. "
            )}
            Volume numbers are the Japanese release's, which the English one
            nearly always matches.
          </p>
        </>
      )}
    </div>
  );
}

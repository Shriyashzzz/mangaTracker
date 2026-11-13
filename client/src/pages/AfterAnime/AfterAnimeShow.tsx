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
  getBuyOffers,
  type AfterAnime,
  type BuyOffer,
} from "../../lib/afterAnime";
import {
  answerSentence,
  latestStop,
  showQuestions,
  volumesToGet,
  withoutThe,
} from "../../lib/afterAnimeText";
import { HttpError } from "../../lib/api";
import { formatCents, seriesCanonicalPath, timeAgo } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { linkRel } from "../Prices/offerLabels";
import { usePageMeta } from "../../lib/seo";
import { pricesStyles as priceStyles } from "../Prices/styles";
import { useSeriesLoad } from "../Prices/useSeriesData";
import FixForm from "./FixForm";
import MoreShows from "./MoreShows";
import { bookFor } from "./bookFor";
import SeasonPanel from "./SeasonPanel";
import SeasonTable from "./SeasonTable";
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

// each wanted volume's saved buy link, once the series' volumes are in.
// Nothing while they load, and nothing if it can't be asked: the buttons
// then open the volume's own page
function useBuyOffers(show: AfterAnime | null, volumes: SeriesVolume[] | null) {
  const isbns =
    show && volumes
      ? show.stops
          .flatMap(volumesToGet)
          .map((want) => bookFor(volumes, want.volume)?.isbn13.trim())
          .filter((isbn): isbn is string => Boolean(isbn))
      : [];
  // one string, so the effect runs again only when the volumes change
  const wanted = [...new Set(isbns)].sort().join(",");
  const [found, setFound] = useState<{
    wanted: string;
    offers: Record<string, BuyOffer>;
  }>({ wanted: "", offers: {} });
  useEffect(() => {
    if (!wanted) return;
    const controller = new AbortController();
    getBuyOffers(wanted.split(","), controller.signal)
      .then((offers) => setFound({ wanted, offers }))
      .catch(() => {
        // no buy links: every button opens its volume's page
      });
    return () => controller.abort();
  }, [wanted]);
  return found.wanted === wanted ? found.offers : {};
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

  const offers = useBuyOffers(show, volumes);

  usePageMeta(showMeta(show, problem !== "", location.origin));

  const name = show?.name ?? asked;
  // the season most people have just finished comes first
  const latest = show ? latestStop(show.stops) : undefined;
  const newestFirst = show ? [...show.stops].reverse() : [];
  // the whole run in one buy, when a box set is priced (cheapest first)
  const boxSet = series.data?.boxSets?.[0];
  const anAffiliateLink =
    Object.values(offers).some((offer) => offer.affiliate) ||
    Boolean(boxSet?.affiliate);
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
          Where does the{" "}
          <span className={styles.named}>{withoutThe(name)}</span> anime leave
          off?
        </h1>
        {latest && <p className={styles.lead}>{answerSentence(latest)}</p>}
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
              Compare prices for every {show.name} volume
            </NavLink>
          </div>
          <FixForm seriesName={show.name} season={null} open />
        </section>
      )}

      {show && show.stops.length > 0 && (
        <>
          {show.stops.length > 1 && <SeasonTable stops={newestFirst} />}
          <div className={styles.seasons}>
            {newestFirst.map((stop) => (
              <SeasonPanel
                key={stop.label}
                stop={stop}
                seriesName={show.name}
                volumes={volumes}
                offers={offers}
              />
            ))}
          </div>
          {boxSet?.url && (
            <p className={styles.boxSet}>
              Want the whole run in one go? There's a {show.name} box set from{" "}
              <strong>{formatCents(boxSet.priceCents)}</strong> at{" "}
              <a href={boxSet.url} target="_blank" rel={linkRel(boxSet)}>
                {boxSet.store}
              </a>
              .
            </p>
          )}
          <div className={styles.more}>
            <NavLink
              to={seriesCanonicalPath(show.name)}
              className="btn"
              viewTransition
            >
              Compare every volume's price
            </NavLink>
            <NavLink to={AFTER_ANIME_PATH} className="btn" viewTransition>
              Look up another show
            </NavLink>
          </div>
          {/* the same questions and answers the page's markup gives search
              engines (showJsonLd) */}
          <section aria-labelledby="questions-title">
            <h2 id="questions-title" className={priceStyles.sectionTitle}>
              Questions
            </h2>
            <dl className={styles.questions}>
              {showQuestions(show).map(({ q, a }) => (
                <div key={q}>
                  <dt className={styles.question}>{q}</dt>
                  <dd className={styles.answer}>{a}</dd>
                </div>
              ))}
            </dl>
          </section>
          <MoreShows notThis={show.slug} />
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
            {anAffiliateLink &&
              " Some store links are affiliate links, which help keep the site running at no cost to you."}
          </p>
        </>
      )}
    </div>
  );
}

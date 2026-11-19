// /after-the-anime/:slug  Where to start a series' manga after its anime.
// Top to bottom: the answer for the latest season with its volume to buy
// beside it (the ticket), what's left to read and what it costs, a table of
// every season (long shows only), a panel per earlier season, and the
// questions the page hasn't answered yet. The seasons come from
// /api/after-anime; the volumes and prices from the same series list the
// price page uses.
import AnswerWords from "./AnswerWords";
import {
  buyVolume,
  keepNumbers,
  latestAnswer,
  latestStop,
  leftLine,
  hasNoEndYet,
  noAnswerLine,
  pageHeading,
  placeAfter,
  seasonAnchor,
  showMeta,
  showQuestions,
} from "../../lib/afterAnimeText";
import { useEffect, useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import {
  AFTER_ANIME_PATH,
  getAfterAnime,
  getBuyOffers,
  type AfterAnime,
  type VolumeOffers,
} from "../../lib/afterAnime";
import { HttpError, signInPath } from "../../lib/api";
import { formatCents, seriesCanonicalPath, timeAgo } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { linkRel } from "../Prices/offerLabels";
import { usePageMeta } from "../../lib/seo";
import { faqStyles } from "../Faq/styles";
import { pricesStyles as priceStyles } from "../Prices/styles";
import { useSeriesLoad } from "../Prices/useSeriesData";
import FixForm from "./FixForm";
import MoreShows from "./MoreShows";
import { bookFor, bookWords } from "./bookFor";
import SeasonBuy from "./SeasonBuy";
import SeasonNotes from "./SeasonNotes";
import SeasonPanel from "./SeasonPanel";
import { ALL_VOLUMES } from "./words";
import { useAuth } from "../../store/auth";
import SeasonTable from "./SeasonTable";
import { afterAnimeStyles as styles } from "./styles";

// a long show gets every season at a glance in a table above the panels;
// on a short one the table would only repeat the panels right under it
const TABLE_FROM_SEASONS = 4;

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
          .map(buyVolume)
          .filter((volume): volume is number => volume !== null)
          .map((volume) => bookFor(volumes, volume)?.isbn13.trim())
          .filter((isbn): isbn is string => Boolean(isbn))
      : [];
  // one string, so the effect runs again only when the volumes change
  const wanted = [...new Set(isbns)].sort().join(",");
  const [found, setFound] = useState<{
    wanted: string;
    offers: Record<string, VolumeOffers>;
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
  // its answer, naming the book to buy once the English list is in: "Buy
  // Book 7 (vols. 13–14)" for a series sold only as books of two
  const answer =
    latest &&
    latestAnswer(
      latest,
      volumes ? (n) => bookWords(bookFor(volumes, n), n) : undefined,
    );
  const newestFirst = show ? [...show.stops].reverse() : [];
  // every season but the latest, which is the page's own opening
  const earlier = newestFirst.filter((stop) => stop !== latest);
  // what's left after the latest season, and what it costs (saved prices)
  const left =
    show && latest
      ? leftLine(latest, show.manga, show.books ?? [], formatCents)
      : "";
  // the add form, with the series and where the season leaves them filled
  // in: the last chapter it covered, the last volume it covered all of
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const place = latest ? placeAfter(latest) : null;
  const trackPath = `/add?${new URLSearchParams({
    title: name,
    ...(place?.chapter ? { chapter: String(place.chapter) } : {}),
    ...(place?.volume ? { readVolume: String(place.volume) } : {}),
  })}`;
  // several volumes in one buy, when a store has a box set priced (cheapest
  // first). Not eBay's: a single volume listed there as a "set" gave Bleach a
  // box set for $15
  const boxSet = series.data?.boxSets?.find((set) => !/ebay/i.test(set.store));
  // the questions the page hasn't already answered above
  const questions = show
    ? showQuestions(show).filter((question) => question.shown)
    : [];
  const hasAnswer = !show || show.stops.length > 0;
  const anAffiliateLink =
    Object.values(offers).some(
      (offer) => offer.new?.affiliate || offer.used?.affiliate,
    ) || Boolean(boxSet?.affiliate);
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
        {/* the series inked in, then what the page is for; read out as
            one line (pageHeading) */}
        <h1 className={styles.title} aria-label={pageHeading(name, hasAnswer)}>
          <span className={styles.named}>{name}</span>
          <span>
            {hasAnswer ? "Where to start the manga" : "No answer yet"}
          </span>
        </h1>
        {answer && (
          // the question on its own line, the answer under it
          <p className={styles.lead}>
            <span className={styles.leadAsked}>{answer.asked}</span>{" "}
            <span className="block">
              <AnswerWords text={keepNumbers(answer.lead)} />
            </span>
          </p>
        )}
        {/* the answer to buy, beside the words on a laptop and right under
            the answer on a phone: the price and the button are in the
            first screen either way */}
        {show && latest && (
          <div className={styles.ticket} id={seasonAnchor(latest)}>
            <SeasonBuy
              stop={latest}
              seriesName={show.name}
              volumes={volumes}
              offers={offers}
              seriesCoverUrl={show.coverUrl}
              lead
            />
          </div>
        )}
        {show && latest && answer && (
          <div className={styles.headRest}>
            <p className={styles.sub}>{keepNumbers(answer.detail)}</p>
            <SeasonNotes stop={latest} />
            {!latest.coversAll && (
              <p className={styles.track}>
                Going to read it?{" "}
                <NavLink
                  to={isSignedIn === false ? signInPath(trackPath) : trackPath}
                  className={styles.link}
                  // a sign-in page per show is nothing for a search engine
                  rel="nofollow"
                  viewTransition
                >
                  Keep your place from where the anime stops
                </NavLink>
              </p>
            )}
            {/* the full width of the words, as in a season's panel */}
            <div className="w-full">
              <FixForm seriesName={show.name} season={latest.label} />
            </div>
          </div>
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
            <p className={styles.end}>{noAnswerLine(show.name, show.anime)}</p>
            <NavLink
              to={seriesCanonicalPath(show.name)}
              className={styles.link}
              viewTransition
            >
              {ALL_VOLUMES}
            </NavLink>
          </div>
          {/* opened ready to fill in, unless the anime hasn't ended: then
              there's nothing to tell us yet, and it stays a closed link */}
          <FixForm
            seriesName={show.name}
            season={null}
            open={!hasNoEndYet(show.anime)}
          />
        </section>
      )}

      {show && show.stops.length > 0 && (
        <>
          {left && (
            <section className={styles.left} aria-labelledby="left-title">
              <div>
                <h2 id="left-title" className={styles.leftTitle}>
                  What's left to read
                </h2>
                <p className={styles.leftText}>{left}</p>
              </div>
              <NavLink
                to={seriesCanonicalPath(show.name)}
                className="btn shrink-0"
                viewTransition
              >
                {ALL_VOLUMES}
              </NavLink>
            </section>
          )}
          {boxSet?.url && (
            <p className={styles.boxSet}>
              Buying several? A {show.name} box set is{" "}
              <strong>{formatCents(boxSet.priceCents)}</strong> at{" "}
              <a href={boxSet.url} target="_blank" rel={linkRel(boxSet)}>
                {boxSet.store}
              </a>
              .
            </p>
          )}
          {show.stops.length >= TABLE_FROM_SEASONS && (
            <SeasonTable
              stops={newestFirst}
              seriesName={show.name}
              volumes={volumes}
            />
          )}
          {earlier.length > 0 && (
            <>
              <h2 className={styles.earlier}>Watched less? Earlier seasons</h2>
              <div className={styles.seasons}>
                {earlier.map((stop) => (
                  <SeasonPanel
                    key={stop.label}
                    stop={stop}
                    seriesName={show.name}
                    volumes={volumes}
                    offers={offers}
                    seriesCoverUrl={show.coverUrl}
                  />
                ))}
              </div>
            </>
          )}
          <div className={styles.more}>
            {/* said once: the strip above has it when there's a strip */}
            {!left && (
              <NavLink
                to={seriesCanonicalPath(show.name)}
                className="btn"
                viewTransition
              >
                {ALL_VOLUMES}
              </NavLink>
            )}
            <NavLink to={AFTER_ANIME_PATH} className="btn" viewTransition>
              Look up another show
            </NavLink>
          </div>
          {/* only what the page hasn't said above; the rest of the questions
              are in its markup for search engines (showJsonLd) */}
          {questions.length > 0 && (
            <section aria-labelledby="questions-title">
              <h2 id="questions-title" className={priceStyles.sectionTitle}>
                Questions
              </h2>
              {/* rows that open, as on the FAQ page */}
              <div className={faqStyles.list}>
                {questions.map(({ q, shown, a, list }) => (
                  <details key={q} className={faqStyles.item}>
                    <summary className={faqStyles.question}>
                      {shown}
                      <span className={faqStyles.mark} aria-hidden />
                    </summary>
                    <div className={faqStyles.answer}>
                      <p>{keepNumbers(a)}</p>
                      {/* a long show's earlier seasons, a line each */}
                      {list && list.length > 0 && (
                        <ul className={styles.answerList}>
                          {list.map((line) => (
                            <li key={line}>{keepNumbers(line)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
          <MoreShows notThis={show.slug} />
          <ul className={styles.credit}>
            <li>
              {show.sourceUrl ? (
                <>
                  Source:{" "}
                  <a href={show.sourceUrl} target="_blank" rel="noreferrer">
                    MangaUpdates
                  </a>
                  {show.checkedAt && `, checked ${timeAgo(show.checkedAt)}`}.
                </>
              ) : (
                "Source: sent in by a reader, and checked."
              )}
            </li>
            <li>
              Volume numbers follow the Japanese edition. English volumes almost
              always match.
            </li>
            {anAffiliateLink && (
              <li>
                Some store links are affiliate links. They cost you nothing and
                help keep the site running.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

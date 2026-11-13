// One season of an "after the anime" page: what to start at, where the
// season stops, and the volumes to buy to carry on (BuyRow). The words are
// lib/afterAnimeText.ts; the volumes come from the series' own list.
import { NavLink } from "react-router";
import type { BuyOffer } from "../../lib/afterAnime";
import {
  afterLabel,
  endText,
  seasonAnchor,
  startText,
  twoVolumesNote,
  volumesToGet,
  type AnimeStop,
} from "../../lib/afterAnimeText";
import { seriesCanonicalPath } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { bookFor } from "./bookFor";
import BuyRow from "./BuyRow";
import FixForm from "./FixForm";
import { afterAnimeStyles as styles } from "./styles";

export default function SeasonPanel({
  stop,
  seriesName,
  // the series' English volumes; null while they load
  volumes,
  // each volume's saved buy link, by ISBN
  offers,
}: {
  stop: AnimeStop;
  seriesName: string;
  volumes: SeriesVolume[] | null;
  offers: Record<string, BuyOffer>;
}) {
  const wanted = volumesToGet(stop);
  const books = wanted.map((want) => ({
    ...want,
    book: volumes ? bookFor(volumes, want.volume) : null,
  }));
  const found = books.filter((want) => want.book);
  // the list is in and has none of them: not out in English, or numbered
  // another way
  const noneListed = volumes !== null && wanted.length > 0 && !found.length;
  const where = endText(stop);
  const whyTwo = twoVolumesNote(stop);

  return (
    <section className={styles.season} id={seasonAnchor(stop)}>
      <div className={styles.seasonWords}>
        {/* one heading, on two lines: the season, then the answer */}
        <h2 className={styles.seasonHeading}>
          <span className={styles.seasonTitle}>{afterLabel(stop)}</span>
          <span className="sr-only">: </span>
          <span className={styles.start}>{startText(stop)}</span>
        </h2>
        {where && <p className={styles.end}>{where}</p>}
        {stop.note && <p className={styles.note}>Worth knowing: {stop.note}</p>}
        {stop.corrected && (
          <span className={styles.corrected}>Corrected by a reader</span>
        )}
      </div>

      {wanted.length > 0 && (
        <div className={styles.volumes}>
          {volumes === null && (
            <div
              className={`skeleton ${styles.buySkeleton}`}
              aria-busy="true"
            />
          )}
          {found.length > 0 && (
            <ul className={styles.buyList}>
              {found.map(({ volume, why, book }) => (
                <BuyRow
                  key={volume}
                  volume={volume}
                  why={why}
                  book={book!}
                  offer={offers[book!.isbn13.trim()]}
                />
              ))}
            </ul>
          )}
          {found.length > 1 && whyTwo && (
            <p className={styles.volumesNote}>{whyTwo}</p>
          )}
          {noneListed && (
            <p className={styles.volumesNote}>
              {wanted.length > 1
                ? `Volumes ${wanted[0]!.volume} and ${wanted[1]!.volume} aren't`
                : `Volume ${wanted[0]!.volume} isn't`}{" "}
              in our English list yet.{" "}
              <NavLink
                to={seriesCanonicalPath(seriesName)}
                className={styles.link}
                viewTransition
              >
                See what's out
              </NavLink>
            </p>
          )}
        </div>
      )}

      <FixForm seriesName={seriesName} season={stop.label} />
    </section>
  );
}

// One season of an "after the anime" page: what to start at, where the
// season stops, and the volumes to get with their prices. The words are
// lib/afterAnimeText.ts; the volumes come from the series' own list.
import { NavLink } from "react-router";
import {
  afterLabel,
  endText,
  startText,
  twoVolumesNote,
  volumesToGet,
  type AnimeStop,
} from "../../lib/afterAnimeText";
import { seriesCanonicalPath } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import VolumeCard from "../Prices/VolumeCard";
import FixForm from "./FixForm";
import { afterAnimeStyles as styles } from "./styles";

// the book for a volume number: one sold on its own, with a price when
// there's a choice
function bookFor(volumes: SeriesVolume[], number: number) {
  const matches = volumes.filter((v) => v.volume === number && !v.inBook);
  return matches.find((v) => v.knownPriceCents !== null) ?? matches[0] ?? null;
}

export default function SeasonPanel({
  stop,
  seriesName,
  seriesCoverUrl,
  // the series' English volumes; null while they load
  volumes,
}: {
  stop: AnimeStop;
  seriesName: string;
  seriesCoverUrl: string | null;
  volumes: SeriesVolume[] | null;
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
    <section className={styles.season}>
      <div className={styles.seasonWords}>
        <h2 className={styles.seasonTitle}>{afterLabel(stop)}</h2>
        <p className={styles.start}>{startText(stop)}</p>
        {where && <p className={styles.end}>{where}</p>}
        {stop.note && <p className={styles.note}>Worth knowing: {stop.note}</p>}
        {stop.corrected && (
          <span className={styles.corrected}>Corrected by a reader</span>
        )}
      </div>

      {wanted.length > 0 && (
        <div className={styles.volumes}>
          {volumes === null && (
            <div className={styles.volumeRow} aria-busy="true">
              {wanted.map((want) => (
                <div
                  key={want.volume}
                  className={`skeleton ${styles.volumeSkeleton}`}
                />
              ))}
            </div>
          )}
          {found.length > 0 && (
            <ul className={styles.volumeRow}>
              {found.map(({ volume, why, book }) => (
                <li key={volume}>
                  <VolumeCard
                    isbn13={book!.isbn13}
                    title={`Vol. ${volume}`}
                    fullTitle={book!.title}
                    volume={volume}
                    coverUrl={book!.coverUrl}
                    seriesCoverUrl={seriesCoverUrl}
                    subtitle={why}
                    priceCents={book!.knownPriceCents}
                  />
                </li>
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

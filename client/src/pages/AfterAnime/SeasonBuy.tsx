// What to buy after one season: the one volume to carry on with (BuyRow),
// the volume after it for someone who has that one, or why there's nothing
// to buy yet. Shown in the page's ticket for the latest season and in each
// earlier season's panel, so both say it the same way.
import { NavLink } from "react-router";
import type { VolumeOffers } from "../../lib/afterAnime";
import {
  buyVolume,
  keepNumbers,
  volumeAfter,
  whyThisVolume,
  type AnimeStop,
} from "../../lib/afterAnimeText";
import { seriesCanonicalPath, volumePath } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { bookAfter, bookFor, bookShort } from "./bookFor";
import BuyRow from "./BuyRow";
import { ALL_VOLUMES } from "./words";
import { afterAnimeStyles as styles } from "./styles";

export default function SeasonBuy({
  stop,
  seriesName,
  // the series' English volumes; null while they load
  volumes,
  // each volume's saved buy link, by ISBN
  offers,
  seriesCoverUrl,
  // the page's ticket, for the latest season: its price is said larger
  lead = false,
}: {
  stop: AnimeStop;
  seriesName: string;
  volumes: SeriesVolume[] | null;
  offers: Record<string, VolumeOffers>;
  seriesCoverUrl: string | null;
  lead?: boolean;
}) {
  const toBuy = buyVolume(stop);
  const book = toBuy !== null && volumes ? bookFor(volumes, toBuy) : null;
  const after = volumeAfter(stop);
  // the one after it: the next volume, or the next book of two
  const next =
    after !== null && toBuy !== null && volumes
      ? bookAfter(volumes, toBuy)
      : null;
  // the list is in and doesn't have it: not out in English yet
  const notListed = toBuy !== null && volumes !== null && !book;
  // a chapter to start at but no volume on record (a series first published
  // by the chapter, like Solo Leveling)
  const volumeUnknown =
    toBuy === null && !stop.coversAll && stop.nextChapter !== null;
  const allVolumes = (
    <NavLink
      to={seriesCanonicalPath(seriesName)}
      className="btn btn-primary w-fit"
      viewTransition
    >
      {ALL_VOLUMES}
    </NavLink>
  );

  return (
    <>
      {toBuy !== null && volumes === null && (
        <div className={`skeleton ${styles.buySkeleton}`} aria-busy="true" />
      )}
      {book && (
        <ul className={styles.buyList}>
          <BuyRow
            volume={toBuy!}
            why={keepNumbers(whyThisVolume(stop))}
            book={book}
            offer={offers[book.isbn13.trim()]?.new ?? null}
            used={offers[book.isbn13.trim()]?.used ?? null}
            seriesCoverUrl={seriesCoverUrl}
            seriesName={seriesName}
            lead={lead}
          />
        </ul>
      )}
      {/* for someone who already has the pick */}
      {book && next && (
        <p className={styles.volumesNote}>
          Already have{" "}
          {book.inBook ? bookShort(book, toBuy!) : `volume ${toBuy}`}?{" "}
          <NavLink
            to={volumePath(next.isbn13, next.title)}
            className={styles.link}
            viewTransition
          >
            {next.inBook ? bookShort(next, after!) : `Volume ${after}`} is next
          </NavLink>
        </p>
      )}
      {notListed && (
        <>
          <p className={styles.volumesNote}>
            Volume {toBuy} isn't out in English yet.
          </p>
          {allVolumes}
        </>
      )}
      {volumeUnknown && (
        <>
          <p className={styles.volumesNote}>
            We don't know yet which volume has chapter {stop.nextChapter}.
          </p>
          {allVolumes}
        </>
      )}
      {/* the anime told all of it: nothing to carry on with, but the manga
          is still there to own */}
      {stop.coversAll && (
        <>
          <p className={styles.volumesNote}>Want it on your shelf?</p>
          {allVolumes}
        </>
      )}
    </>
  );
}

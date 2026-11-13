// One season of an "after the anime" page: what to start at, and the one
// volume to buy to carry on (BuyRow). The words are lib/afterAnimeText.ts;
// the volume's book comes from the series' own list.
import { NavLink } from "react-router";
import type { VolumeOffers } from "../../lib/afterAnime";
import {
  afterLabel,
  buyVolume,
  endText,
  keepNumbers,
  seasonAnchor,
  startText,
  volumeAfter,
  whyThisVolume,
  type AnimeStop,
} from "../../lib/afterAnimeText";
import { seriesCanonicalPath, volumePath } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { bookFor } from "./bookFor";
import BuyRow from "./BuyRow";
import FixForm from "./FixForm";
import { afterAnimeStyles as styles } from "./styles";

// the one label for the way to a series' volumes, wherever it's offered
export const ALL_VOLUMES = "See all volumes and prices";

export default function SeasonPanel({
  stop,
  seriesName,
  // the series' English volumes; null while they load
  volumes,
  // each volume's saved buy link, by ISBN
  offers,
  // the page's opening answer is about this season: its sentence on where
  // the season stops isn't said a second time here
  saidAbove,
}: {
  stop: AnimeStop;
  seriesName: string;
  volumes: SeriesVolume[] | null;
  offers: Record<string, VolumeOffers>;
  saidAbove: boolean;
}) {
  const toBuy = buyVolume(stop);
  const book = toBuy !== null && volumes ? bookFor(volumes, toBuy) : null;
  const after = volumeAfter(stop);
  const bookAfter = after !== null && volumes ? bookFor(volumes, after) : null;
  // the list is in and doesn't have it: not out in English yet
  const notListed = toBuy !== null && volumes !== null && !book;
  // a chapter to start at but no volume on record (a series first published
  // by the chapter, like Solo Leveling)
  const volumeUnknown =
    toBuy === null && !stop.coversAll && stop.nextChapter !== null;
  const where = saidAbove ? "" : endText(stop);
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
    <section className={styles.season} id={seasonAnchor(stop)}>
      <div className={styles.seasonWords}>
        {/* one heading, on two lines: the season, then the answer */}
        <h2 className={styles.seasonHeading}>
          <span className={styles.seasonTitle}>
            {keepNumbers(afterLabel(stop))}
          </span>
          <span className="sr-only">: </span>
          <span className={styles.start}>{keepNumbers(startText(stop))}</span>
        </h2>
        {where && <p className={styles.end}>{keepNumbers(where)}</p>}
        {stop.note && <p className={styles.note}>Worth knowing: {stop.note}</p>}
        {stop.corrected && (
          <span className={styles.corrected}>Corrected by a reader</span>
        )}
      </div>

      <div className={styles.volumes}>
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
            />
          </ul>
        )}
        {/* for someone who already has the pick */}
        {book && bookAfter && (
          <p className={styles.volumesNote}>
            Already have volume {toBuy}?{" "}
            <NavLink
              to={volumePath(bookAfter.isbn13, bookAfter.title)}
              className={styles.link}
              viewTransition
            >
              Volume {after} is next
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
      </div>

      <FixForm seriesName={seriesName} season={stop.label} />
    </section>
  );
}

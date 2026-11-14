// Rating a volume from a series' page, for the next buyer to see on that
// volume's price page (Prices/reviews/). The page asks one of two ways
// (useRateVolume.ts decides which):
//   RateVolumeCard   "How was vol. 9?" in a banner: a box like the notes
//                    box under it, for a few days after they finish a
//                    volume. Its cross closes it until they finish another
//   RateVolume       any other time: a ticket beside the series' own
//                    rating, with the volume's number on an inked stub and
//                    smaller stars, so the two ratings can't be taken for
//                    each other. Always about the last volume they've read,
//                    rated or not; "Rate vol. 8" on it moves to the one
//                    before, for the visit: one volume at a time, never a
//                    list of chores
// Either way one tap saves, a second tap on the same star takes it back, and
// "Add a few words" opens the review box. When the volume they've read is
// one we have no book for, the stars are on the nearest one below that we
// do have. Nothing shows for a series with none of their volumes on file.
import { InkCrossIcon } from "../../components/icons/Icons";
import StarRating from "../../components/starRating/StarRating";
import type { ShelfVolume } from "../../lib/reviews";
import { detailsStyles as styles } from "./styles";
import type { VolumeRating } from "./useRateVolume";

type Props = {
  volume: VolumeRating;
  // "Add a few words": the page opens the review box for this volume
  onWrite: (volume: ShelfVolume) => void;
};

// under a volume's stars once it's rated: the quiet ways on. The banner is
// about the one volume just finished, so it never offers the next
function WaysOn({
  volume,
  onWrite,
  offersNext = false,
  className = styles.rateLinks,
}: Props & { offersNext?: boolean; className?: string }) {
  const { asked, rating, hasWords, next, moveOn } = volume;
  if (!asked) return null;
  return (
    <p className={className}>
      {/* words go with a rating: offered once there is one */}
      {rating > 0 && (
        <button type="button" onClick={() => onWrite(asked)}>
          {hasWords ? "Edit your review" : "Add a few words"}
        </button>
      )}
      {offersNext && next && (
        <button type="button" onClick={moveOn}>
          {/* under an unrated "Rate vol. 9", a second "Rate vol." needs
              telling apart */}
          Rate vol. {next.volume}
          {rating > 0 ? "" : " instead"}
        </button>
      )}
    </p>
  );
}

export default function RateVolume({ volume, onWrite }: Props) {
  const { asked, rating, problem, rate } = volume;
  if (!asked) return null;
  return (
    // a ticket, like the ones in "Buy it": the volume's number on an inked
    // stub, then its stars. Not a second row of the series' stars
    <div
      className={styles.rateTicket}
      role="group"
      aria-label={
        rating
          ? `Your rating of vol. ${asked.volume}`
          : `Rate vol. ${asked.volume}`
      }
    >
      <span className={styles.rateStub} aria-hidden>
        <small>Vol.</small>
        {asked.volume}
      </span>
      <div className={styles.rateTicketBody}>
        {/* one short line over the stars: what it's asking, and the ways
            on. Once it's rated the filled stars say it, so the words go */}
        <div className={styles.rateTicketTop}>
          {!rating && (
            <span className={styles.rateTicketLabel}>How was it?</span>
          )}
          {(rating > 0 || volume.next) && (
            <WaysOn
              volume={volume}
              onWrite={onWrite}
              offersNext
              className={styles.rateTicketLinks}
            />
          )}
        </div>
        <StarRating value={rating} size="md" onChange={rate} />
        <p className={styles.saveFailed} role="status">
          {problem}
        </p>
      </div>
    </div>
  );
}

export function RateVolumeCard({ volume, onWrite }: Props) {
  const { asked, rating, problem, rate, closeBanner } = volume;
  if (!asked) return null;
  return (
    <div className={styles.rateCardIn}>
      <div className={styles.rateCardClip}>
        <section className={styles.rateCard}>
          <div className={styles.rateWords}>
            <h2 className={styles.rateTitle}>
              {rating
                ? `Your rating of vol. ${asked.volume}`
                : `How was vol. ${asked.volume}?`}
            </h2>
            {rating ? (
              <WaysOn volume={volume} onWrite={onWrite} />
            ) : (
              <p className={styles.rateNote}>
                Your rating helps the next reader decide.
              </p>
            )}
            <p className={styles.saveFailed} role="status">
              {problem}
            </p>
          </div>
          <StarRating value={rating} size="lg" onChange={rate} />
          <button
            type="button"
            className={styles.rateClose}
            aria-label="Hide this"
            onClick={async () => {
              await closeBanner();
              // the cross is gone with the banner: the keyboard carries on
              // from the small stars that took its place, not the page's top
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLElement>(
                    '[data-volume-stars] [role="radio"][tabindex="0"]',
                  )
                  ?.focus(),
              );
            }}
          >
            <InkCrossIcon className="size-[1.1rem]" />
          </button>
        </section>
      </div>
    </div>
  );
}

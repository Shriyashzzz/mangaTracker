// "Rate vol. 9", beside the series' own rating and drawn the same way: a
// label and five stars. One tap rates the latest volume they've read and
// haven't rated, for the next buyer to see on that volume's price page
// (Prices/reviews/). One volume at a time, never a list of chores: once
// it's rated, "Add a few words" opens the review box and "Rate vol. 8"
// moves on. Nothing shows for a series with nothing to rate.
import { useState } from "react";
import StarRating from "../../components/starRating/StarRating";
import {
  saveReview,
  type ShelfVolume,
  type WrittenReview,
} from "../../lib/reviews";
import { detailsStyles as styles } from "./styles";

export default function RateVolume({
  toRate,
  written,
  onRated,
  onWrite,
}: {
  // the volumes they could rate, the one to ask about first
  toRate: ShelfVolume[];
  // their reviews of this series, to show the rating just given
  written: WrittenReview[];
  // a rating was saved: the page asks for the lists again
  onRated: () => Promise<void>;
  // "Add a few words": the page opens the review box for this volume
  onWrite: (volume: ShelfVolume) => void;
}) {
  // The volume just rated stays in place until they move on. Without this
  // the question would jump to the next volume the moment the rating saved,
  // and "Add a few words" would be gone before they could reach it
  const [rated, setRated] = useState<ShelfVolume | null>(null);
  // the stars they tapped, shown at once while it saves
  const [tapped, setTapped] = useState(0);
  const [problem, setProblem] = useState("");

  const asked = rated ?? toRate[0];
  if (!asked) return null;
  const saved = written.find((one) => one.isbn13 === asked.isbn13);
  const rating = saved?.review.rating ?? tapped;
  const next = toRate.find((volume) => volume.isbn13 !== asked.isbn13);

  const rate = async (stars: number) => {
    // a second tap on the same star would clear it: a rating stays
    if (!stars) return;
    setTapped(stars);
    setRated(asked);
    setProblem("");
    const result = await saveReview(asked.isbn13, {
      rating: stars,
      // their words, if they've written some, are kept
      text: saved?.review.text ?? "",
      spoiler: saved?.review.spoiler ?? false,
    });
    if ("problem" in result) {
      setTapped(0);
      setRated(null);
      setProblem(result.problem);
    } else await onRated();
  };
  const moveOn = () => {
    setRated(null);
    setTapped(0);
  };

  return (
    <div className={styles.rating}>
      <span className={styles.label}>
        {rating
          ? `Your rating of vol. ${asked.volume}`
          : `Rate vol. ${asked.volume}`}
      </span>
      <span className="inline-block w-fit">
        <StarRating value={rating} size="lg" onChange={rate} />
      </span>
      {rating > 0 && (
        <p className={styles.rateLinks}>
          <button type="button" onClick={() => onWrite(asked)}>
            {saved?.review.text ? "Edit your review" : "Add a few words"}
          </button>
          {next && (
            <button type="button" onClick={moveOn}>
              Rate vol. {next.volume}
            </button>
          )}
        </p>
      )}
      <p className={styles.saveFailed} role="status">
        {problem}
      </p>
    </div>
  );
}

// "You've read vol. 8. How was it?" on a series' page: one tap on a star
// rates the latest volume they've read and haven't rated, for the next
// buyer to see on that volume's price page (Prices/reviews/). One volume at
// a time, never a list of chores: once it's rated, the one before is
// offered. Nothing shows for a series with nothing to rate.
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import StarRating from "../../components/starRating/StarRating";
import {
  getVolumesToRate,
  saveReview,
  type VolumeToRate,
} from "../../lib/reviews";
import { detailsStyles as styles } from "./styles";

export default function RateVolume({ mangaId }: { mangaId: number }) {
  // the volumes they could rate, newest first, and which one is asked about
  const [waiting, setWaiting] = useState<VolumeToRate[]>([]);
  const [at, setAt] = useState(0);
  // the rating they just gave the one asked about
  const [given, setGiven] = useState(0);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getVolumesToRate(mangaId, controller.signal)
      .then(setWaiting)
      .catch(() => {
        // an extra: the page is whole without it
      });
    return () => controller.abort();
  }, [mangaId]);

  const asked = waiting[at];
  if (!asked) return null;
  const next = waiting[at + 1];

  const rate = async (stars: number) => {
    // a second tap on the same star would clear it: a rating stays
    if (!stars) return;
    const before = given;
    setGiven(stars);
    setProblem("");
    const result = await saveReview(asked.isbn13, {
      rating: stars,
      text: "",
      spoiler: false,
    });
    if ("problem" in result) {
      setGiven(before);
      setProblem(result.problem);
    }
  };
  const askAboutNext = () => {
    setAt(at + 1);
    setGiven(0);
  };

  return (
    <div className={styles.rateVolume}>
      <div className={styles.rateWords}>
        <h2 className={styles.rateTitle}>
          {given
            ? `Vol. ${asked.volume}: saved`
            : `You've read vol. ${asked.volume}. How was it?`}
        </h2>
        {given ? (
          <p className={styles.rateLinks}>
            <NavLink
              to={`/prices/${asked.isbn13}#reviews-title`}
              viewTransition
            >
              Add a few words
            </NavLink>
            {next && (
              <button type="button" onClick={askAboutNext}>
                Rate vol. {next.volume} too
              </button>
            )}
          </p>
        ) : (
          <p className={styles.rateNote}>
            Your rating helps the next reader decide.
          </p>
        )}
        <p className={styles.saveFailed} role="status">
          {problem}
        </p>
      </div>
      <StarRating value={given} size="lg" onChange={rate} />
    </div>
  );
}

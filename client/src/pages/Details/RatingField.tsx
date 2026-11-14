// The stars on a series' page. A tap shows at once and saves in the
// background; if the save fails the stars go back and a line says so.
import { useState } from "react";
import StarRating from "../../components/starRating/StarRating";
import { apiFetch } from "../../lib/api";
import { detailsStyles as styles } from "./styles";

type Props = { mangaId: number; initial: number };

export default function RatingField({ mangaId, initial }: Props) {
  const [rating, setRating] = useState(initial);
  const [failed, setFailed] = useState(false);

  const save = async (newRating: number) => {
    const previous = rating;
    setRating(newRating);
    setFailed(false);
    try {
      const response = await apiFetch(`/api/manga/${mangaId}/rating`, {
        method: "PATCH",
        body: { rating: newRating },
      });
      if (!response.ok) throw new Error(response.statusText);
    } catch (e) {
      console.error(`failed changing manga rating, ${(e as Error).message}`);
      setRating(previous);
      setFailed(true);
    }
  };

  return (
    <div className={styles.rating}>
      <span className={styles.label}>
        {rating ? "Your rating of the series" : "Rate the series"}
      </span>
      <span className="inline-block w-fit">
        <StarRating value={rating} size="lg" onChange={save} />
      </span>
      <p className={styles.saveFailed} role="status">
        {failed && "That didn't save. Try again."}
      </p>
    </div>
  );
}

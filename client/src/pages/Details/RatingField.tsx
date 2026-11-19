// The stars on a series' page. A tap shows at once and saves in the
// background; with no connection it's kept on this device and goes when
// it's back (lib/offlineChanges.ts). If the server refuses it, the stars go
// back and a line says so.
import { useState } from "react";
import StarRating from "../../components/starRating/StarRating";
import { apiFetch } from "../../lib/api";
import { orOffline } from "../../lib/offline";
import { KEPT_NOTE, saveOrKeep } from "../../lib/offlineChanges";
import { detailsStyles as styles } from "./styles";

type Props = { mangaId: number; initial: number };

export default function RatingField({ mangaId, initial }: Props) {
  const [rating, setRating] = useState(initial);
  const [note, setNote] = useState<"kept" | "failed" | null>(null);

  const save = async (newRating: number) => {
    const previous = rating;
    setRating(newRating);
    setNote(null);
    try {
      const how = await saveOrKeep(mangaId, "rating", previous, newRating, () =>
        apiFetch(`/api/manga/${mangaId}/rating`, {
          method: "PATCH",
          body: { rating: newRating },
        }),
      );
      if (how === "kept") setNote("kept");
    } catch (e) {
      console.error(`failed changing manga rating, ${(e as Error).message}`);
      setRating(previous);
      setNote("failed");
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
      <p
        className={note === "kept" ? styles.notesSaved : styles.saveFailed}
        role="status"
      >
        {note === "kept" && KEPT_NOTE}
        {note === "failed" && orOffline("That didn't save. Try again.")}
      </p>
    </div>
  );
}

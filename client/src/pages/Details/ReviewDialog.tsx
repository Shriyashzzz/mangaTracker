// The box a reader writes or changes a volume's review in, without leaving
// the series' page: stars, a few words, the spoiler tick (the same form as
// on a volume's price page), and the way to delete it. A native dialog: it
// brings its own focus trap, Escape and backdrop.
import { useEffect, useRef, useState } from "react";
import {
  deleteShelfReview,
  saveShelfReview,
  type Review,
  type ShelfVolume,
} from "../../lib/reviews";
import ReviewForm from "../Prices/reviews/ReviewForm";
import { detailsStyles as styles } from "./styles";

export default function ReviewDialog({
  mangaId,
  volume,
  // their review of it so far; null when they haven't rated it
  current,
  onChanged,
  onClose,
}: {
  // the series on their shelf, and which volume of it
  mangaId: number;
  volume: ShelfVolume;
  current: Review | null;
  // saved or deleted: the page asks for its lists again
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  useEffect(() => {
    const box = dialog.current;
    if (!box || box.open) return;
    box.showModal();
    // a dialog puts the focus on its first control, which is star 1
    // whatever the rating: start on the star that's theirs
    box.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
  }, []);

  const close = () => dialog.current?.close();
  const afterSaving = async () => {
    await onChanged();
    close();
  };
  const remove = async () => {
    setDeleteFailed(false);
    if (!(await deleteShelfReview(mangaId, volume.volume)))
      return setDeleteFailed(true);
    await onChanged();
    close();
  };

  return (
    <dialog
      ref={dialog}
      className={styles.reviewDialog}
      aria-labelledby="review-dialog-title"
      onClose={onClose}
      // the backdrop counts as the dialog itself. Its padding is on the
      // inner box, so a click on the padding stays inside
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className={styles.reviewDialogBox}>
        <h2 id="review-dialog-title" className={styles.reviewDialogTitle}>
          Your review of vol. {volume.volume}
        </h2>
        <p className={styles.reviewDialogNote}>
          For readers deciding whether to buy it.
          {/* only true of a volume we have a book, and so a page, for */}
          {volume.isbn13 && " It shows on the volume's price page."}
        </p>
        <ReviewForm
          save={(draft) => saveShelfReview(mangaId, volume.volume, draft)}
          current={current}
          onSaved={afterSaving}
          onCancel={close}
          framed={false}
        />
        {current && (
          <p className={styles.reviewDialogDelete}>
            <button type="button" onClick={remove}>
              Delete this review
            </button>
            {deleteFailed && (
              <span role="status"> That didn't delete. Try again.</span>
            )}
          </p>
        )}
      </div>
    </dialog>
  );
}

// The buttons under a series: Edit details, Mark as finished (or reading),
// and Delete, which asks first. Under them, a line for what just happened:
// a failed save, or "Marked as finished." with an Undo.
import { useEffect, useRef, useState } from "react";
import { detailsStyles as styles } from "./styles";

type Props = {
  name: string;
  finished: boolean;
  // a delete is on its way to the server
  deleting: boolean;
  // what just happened, in words; "" for nothing
  note: string;
  // the note is about marking it finished, and can be taken back
  canUndo: boolean;
  onEdit: () => void;
  onToggleFinished: () => void;
  onUndoFinished: () => void;
  onDelete: () => void;
};

export default function SeriesActions({
  name,
  finished,
  deleting,
  note,
  canUndo,
  onEdit,
  onToggleFinished,
  onUndoFinished,
  onDelete,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  // the Delete button is about to vanish from under the keyboard: put focus
  // on the safe answer, and back again when they keep it
  const hasAsked = useRef(false);
  useEffect(() => {
    if (confirming) {
      hasAsked.current = true;
      keepButton.current?.focus();
    } else if (hasAsked.current) {
      deleteButton.current?.focus();
    }
  }, [confirming]);

  return (
    <div className={styles.actions}>
      <button className="btn btn-secondary" onClick={onEdit}>
        Edit details
      </button>
      <button className="btn btn-secondary" onClick={onToggleFinished}>
        {finished ? "Mark as reading" : "Mark as finished"}
      </button>

      {confirming ? (
        <span className={styles.confirm} role="alert">
          Delete {name} from your shelf? Your chapter, rating and notes go with
          it!
          <button
            className={styles.confirmYes}
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? "deleting…" : "yes, delete it"}
          </button>
          <button
            className={styles.confirmNo}
            ref={keepButton}
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            keep it
          </button>
        </span>
      ) : (
        <button
          ref={deleteButton}
          className={`btn btn-ghost ${styles.deleteBtn}`}
          onClick={() => setConfirming(true)}
        >
          Delete
        </button>
      )}

      <p className={styles.actionNote} role="status">
        {note}
        {canUndo && (
          <button
            type="button"
            className={styles.undo}
            onClick={onUndoFinished}
          >
            Undo
          </button>
        )}
      </p>
    </div>
  );
}

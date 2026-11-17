// "Clear your To buy list?": asked before every volume comes off it. The
// same dialog the shelf asks "Delete 12 series?" in (Home/DeleteManyModal),
// with its styles. A native dialog: it brings its own focus trap, Escape and
// backdrop.
import { useEffect, useRef, useState } from "react";
import { homeStyles as styles } from "../Home/styles";

type Props = {
  count: number;
  // empties the list; throws when it didn't save
  onClear: () => Promise<void>;
  onClose: () => void;
};

export default function ClearListModal({ count, onClear, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [clearing, setClearing] = useState(false);
  const [failed, setFailed] = useState(false);
  const volumes = count === 1 ? "1 volume" : `all ${count} volumes`;

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const clear = async () => {
    setClearing(true);
    setFailed(false);
    try {
      await onClear();
      dialog.current?.close();
    } catch {
      setFailed(true);
      setClearing(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={styles.confirm}
      aria-labelledby="clear-list-title"
      aria-describedby="clear-list-body"
      onClose={onClose}
      onCancel={(e) => {
        // not while it's going: the page has to hear how it went
        if (clearing) e.preventDefault();
      }}
      // the backdrop counts as the dialog itself. Its padding is on the inner
      // box, so a click on the padding stays inside
      onClick={(e) => {
        if (e.target === dialog.current && !clearing) dialog.current.close();
      }}
    >
      <div className={styles.confirmBox}>
        <h2 id="clear-list-title" className={styles.confirmTitle}>
          Clear your To buy list?
        </h2>
        <p id="clear-list-body" className={styles.confirmBody}>
          This takes {volumes} off the list. Your shelf doesn't change. It can't
          be undone.
        </p>
        {failed && (
          <p className={styles.confirmError} role="alert">
            That didn't clear it. Try again.
          </p>
        )}
        <div className={styles.confirmActions}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={clearing}
            onClick={() => dialog.current?.close()}
          >
            Keep the list
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={clearing}
            onClick={() => void clear()}
          >
            {clearing ? "Clearing…" : "Clear the list"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

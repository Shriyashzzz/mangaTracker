// "Delete 12 series?", for the shelf's Select, and "Delete Vagabond?", for a
// series' own page on a phone (Details/SeriesActions.tsx). A native dialog:
// it brings its own focus trap, Escape and backdrop. In the Android app it's
// drawn as Android's own dialog (index.css .app-dialog)
import { useEffect, useRef, useState } from "react";
import type { Manga } from "../../lib/types";
import { homeStyles as styles } from "./styles";
import { orOffline } from "../../lib/offline";

// names shown before "and 9 more"
const NAMED = 5;

type Props = {
  manga: Manga[];
  // says whether it worked
  onDelete: () => Promise<boolean>;
  onClose: () => void;
};

export default function DeleteManyModal({ manga, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const count = manga.length;
  // one series: said by its name, with no list of names
  const one = count === 1 ? manga[0]! : null;
  const series = one ? one.name : `${count} series`;

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const remove = async () => {
    setDeleting(true);
    setFailed(false);
    // gone: the page closes this along with select mode
    if (!(await onDelete())) {
      setFailed(true);
      setDeleting(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={`${styles.confirm} app-dialog`}
      aria-labelledby="delete-many-title"
      aria-describedby="delete-many-body"
      onClose={onClose}
      onCancel={(e) => {
        // not while it's going: the shelf has to hear how it went
        if (deleting) e.preventDefault();
      }}
      // the backdrop counts as the dialog itself. Its padding is on the inner
      // box, so a click on the padding stays inside
      onClick={(e) => {
        if (e.target === dialog.current && !deleting) dialog.current.close();
      }}
    >
      <div className={styles.confirmBox}>
        <h2 id="delete-many-title" className={styles.confirmTitle}>
          Delete {series}?
        </h2>
        <div id="delete-many-body">
          {!one && (
            <ul className={styles.confirmNames}>
              {manga.slice(0, NAMED).map((m) => (
                <li key={m.id} className={styles.confirmName}>
                  {m.name}
                </li>
              ))}
              {count > NAMED && (
                <li className={styles.confirmMore}>and {count - NAMED} more</li>
              )}
            </ul>
          )}
          <p className={styles.confirmBody}>
            {one
              ? "It comes off your shelf with its volumes and books, rating, reading progress and notes."
              : "They come off your shelf with their volumes, ratings and reading progress."}
          </p>
        </div>
        {failed && (
          <p className={styles.confirmError} role="alert">
            {orOffline(
              one
                ? "That didn't delete it. Try again."
                : "That didn't delete them. Try again.",
            )}
          </p>
        )}
        <div className={styles.confirmActions}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={deleting}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting}
            onClick={remove}
          >
            {deleting ? "Deleting…" : one ? "Delete it" : `Delete ${series}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// The volumes that are out for one series and aren't the reader's yet: what
// a New card opens when they're more than one behind. Each row leads to
// that book's prices. A native dialog: it brings its own focus trap, Escape
// and backdrop. On phones it's a sheet at the bottom, as tall as its list.
import { useEffect, useRef } from "react";
import { NavLink } from "react-router";
import { volumePath } from "../../lib/prices";
import { remainingVolumes } from "../../lib/releaseMath";
import type { Manga, ReleaseStatus } from "../../lib/types";
import { homeStyles as styles } from "./styles";

type Props = {
  manga: Manga;
  found: ReleaseStatus;
  // where they are: "You own up to vol. 8"
  yours?: string;
  onClose: () => void;
};

export default function ReleaseModal({ manga, found, yours, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // no closing on the way out: leaving the page takes it with it, and a close
    // here would come back as a close event and shut the next one
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const volumes = remainingVolumes(manga, found);

  return (
    <dialog
      ref={dialog}
      className={styles.modal}
      aria-labelledby="release-title"
      onClose={onClose}
      // the backdrop counts as the dialog itself; its contents are all children
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <div className={styles.modalHead}>
        <h2 id="release-title" className={styles.modalTitle}>
          {manga.name}: {volumes.length}{" "}
          {volumes.length === 1 ? "volume" : "volumes"} behind
        </h2>
        <button
          type="button"
          className={styles.modalClose}
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </div>

      <ul className={styles.modalRows}>
        {/* first in the list: above the rows on a laptop, and at the foot
            on a phone, where the rows stack up from it */}
        {yours && <li className={styles.modalYours}>{yours}</li>}
        {volumes.map((v) => (
          <li key={v.volume} className={styles.modalRow}>
            {v.isbn13 ? (
              <NavLink
                to={volumePath(v.isbn13, v.title ?? "")}
                className={styles.modalRowLink}
                viewTransition
              >
                Vol. {v.volume}
                <span className={styles.modalRowGo}>See prices</span>
              </NavLink>
            ) : (
              <span className={styles.modalName}>Vol. {v.volume}</span>
            )}
          </li>
        ))}
      </ul>

      <div className={styles.modalFoot}>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

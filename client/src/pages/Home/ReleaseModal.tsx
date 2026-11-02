// Everything that's out for one series, when a reader has asked to see it all.
// A native dialog: it brings its own focus trap, Escape and backdrop.
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { volumePath } from "../../lib/prices";
import {
  remainingChapters,
  remainingJapanVolumes,
  remainingVolumes,
  type SeenKind,
} from "../../lib/shelf";
import type { Manga, ReleaseStatus } from "../../lib/types";
import { homeStyles as styles } from "./styles";

// someone can be hundreds of chapters behind, and "Hide all" covers the rest
const MOST_ROWS = 60;

type Props = {
  manga: Manga;
  found: ReleaseStatus;
  kind: SeenKind;
  // hides up to this number, and/or sets the list of single hidden volumes
  onHide: (number: number | null, hiddenVolumes?: number[]) => Promise<boolean>;
  onHideAll: () => void;
  onClose: () => void;
};

export default function ReleaseModal({
  manga,
  found,
  kind,
  onHide,
  onHideAll,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // no closing on the way out: leaving the page takes it with it, and a close
    // here would come back as a close event and shut the next one
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const hide = async (number: number | null, hiddenVolumes?: number[]) => {
    setFailed(false);
    if (!(await onHide(number, hiddenVolumes))) setFailed(true);
  };

  const volumes = remainingVolumes(manga, found);
  const chapters = remainingChapters(manga, found);
  const japan = remainingJapanVolumes(manga, found);
  const left =
    kind === "volume" ? volumes.length : kind === "chapter" ? chapters.length : japan.length;
  const hasHidden =
    kind === "volume"
      ? volumes.length < found.outVolumes.length
      : kind === "chapter"
        ? manga.seenChapter != null
        : manga.seenJapanVolume != null;
  const heading =
    kind === "chapter"
      ? left === 1
        ? "chapter"
        : "chapters"
      : kind === "japan"
        ? "in Japan"
        : left === 1
          ? "volume"
          : "volumes";

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
          {manga.name}: {left} {heading}
        </h2>
        <button
          type="button"
          className={styles.modalClose}
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </div>

      <div className={styles.modalActions}>
        <button type="button" className={styles.modalAll} onClick={onHideAll}>
          Hide all
        </button>
        {hasHidden && (
          <button
            type="button"
            className={styles.modalBack}
            onClick={() => hide(null, kind === "volume" ? [] : undefined)}
          >
            Bring back hidden
          </button>
        )}
      </div>

      {failed && (
        <p className={styles.modalError} role="alert">
          That didn't save. Try again.
        </p>
      )}

      <ul className={styles.modalRows}>
        {kind === "volume" &&
          volumes.map((v) => (
            <li key={v.volume} className={styles.modalRow}>
              {v.isbn13 ? (
                <NavLink
                  to={volumePath(v.isbn13, v.title ?? "")}
                  className={styles.modalLink}
                  viewTransition
                >
                  Vol. {v.volume}
                </NavLink>
              ) : (
                <span className={styles.modalName}>Vol. {v.volume}</span>
              )}
              <button
                type="button"
                className={styles.modalHide}
                aria-label={`Hide vol. ${v.volume}`}
                onClick={() =>
                  hide(manga.seenVolume ?? null, [
                    ...(manga.hiddenVolumes ?? []),
                    v.volume,
                  ])
                }
              >
                Hide
              </button>
            </li>
          ))}

        {kind === "chapter" &&
          chapters.slice(0, MOST_ROWS).map((n) => (
            <li key={n} className={styles.modalRow}>
              <span className={styles.modalName}>Ch. {n}</span>
              <button
                type="button"
                className={styles.modalHide}
                aria-label={`Hide up to ch. ${n}`}
                onClick={() => hide(n)}
              >
                Hide up to here
              </button>
            </li>
          ))}

        {kind === "japan" &&
          japan.map((n) => (
            <li key={n} className={styles.modalRow}>
              <span className={styles.modalName}>Vol. {n}</span>
              <button
                type="button"
                className={styles.modalHide}
                aria-label={`Hide up to vol. ${n}`}
                onClick={() => hide(n)}
              >
                Hide up to here
              </button>
            </li>
          ))}

        {kind === "chapter" && chapters.length > MOST_ROWS && (
          <li className={styles.modalMore}>
            And {chapters.length - MOST_ROWS} more, up to ch. {found.latestChapter}.
          </li>
        )}
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

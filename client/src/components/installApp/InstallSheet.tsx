// "Put it on your home screen": the steps on an iPhone or iPad, which has
// no install button of its own. A native dialog brings its own focus trap,
// Escape and backdrop.
import { useEffect, useRef } from "react";
import { installStyles as styles } from "./styles";

export default function InstallSheet({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="install-title"
      onClose={onClose}
      // the backdrop counts as the dialog itself; its contents are all inside
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className={styles.box}>
        <h2 id="install-title" className={styles.title}>
          Put it on your home screen
        </h2>
        <p className={styles.lead}>
          Three taps, and Manga Tracker opens like an app.
        </p>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNumber} aria-hidden>
              1
            </span>
            <span>
              Tap <strong>Share</strong>
              <ShareMark />
              in Safari's bar
            </span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNumber} aria-hidden>
              2
            </span>
            <span>
              Scroll down, tap <strong>Add to Home Screen</strong>
            </span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNumber} aria-hidden>
              3
            </span>
            <span>
              Tap <strong>Add</strong>
            </span>
          </li>
        </ol>
        <div className={styles.notes}>
          <p>In Chrome on iPhone, Share is at the top right.</p>
          <p>The app keeps its own sign-in: sign in once more inside it.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={close}>
            Got it
          </button>
        </div>
      </div>
    </dialog>
  );
}

// the square with an arrow out of it, as Safari draws Share
const ShareMark = () => (
  <svg
    className={styles.share}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    role="img"
    aria-label="(the square with an arrow pointing up)"
  >
    <path d="M8 7l4-4 4 4M12 3v12" />
    <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
  </svg>
);

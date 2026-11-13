// Small pieces of the book import page: the waiting dots, the names of the
// files in an import, and the Stop button that asks twice.
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "../../components/icons/Icons";
import { useBookImport } from "../../store/bookImport";
import { importStyles as styles } from "./styles";

// three dots hopping in turn while AniList makes us wait. Read out as "…"
export function WaitingDots() {
  return (
    <span className="waiting-dots">
      <span className="sr-only">…</span>
      <span aria-hidden>.</span>
      <span aria-hidden>.</span>
      <span aria-hidden>.</span>
    </span>
  );
}

// one file: its name. Several: how many, and their names on hover on a
// laptop, or a tap on a phone (which also keeps it open on a laptop)
export function FilesInImport({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  // a tap or click anywhere else, or Escape, closes it
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (names.length < 2) return <p className={styles.fileName}>{names[0]}</p>;
  return (
    <div ref={wrap} className={styles.files}>
      <button
        type="button"
        className={`${styles.filesButton} group/button`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        {names.length} files in this import
        <ChevronDownIcon className={styles.filesChevron} />
      </button>
      <div
        id={listId}
        className={`${styles.filesPop} ${open ? "block" : "hidden group-hover/files:block"}`}
      >
        <ul className={styles.filesPanel} aria-label="Files in this import">
          {names.map((name) => (
            <li key={name} className={styles.filesItem}>
              {name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const CONFIRM_FOR_MS = 5000;

// Stop import: a second tap says yes, so a stray one doesn't throw away a long
// match. Left alone, it goes back to how it was
// Cancel import is the same, once matching's done and nothing has gone in yet
export function StopButton({ cancel = false }: { cancel?: boolean }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = window.setTimeout(() => setAsking(false), CONFIRM_FOR_MS);
    return () => clearTimeout(timer);
  }, [asking]);
  if (!asking) {
    return (
      <button
        type="button"
        className={cancel ? styles.cancel : styles.stop}
        onClick={() => setAsking(true)}
      >
        {cancel ? "Cancel import" : "Stop import"}
      </button>
    );
  }
  return (
    <span
      className={styles.stopAsk}
      role="group"
      aria-label={cancel ? "Cancel the import?" : "Stop the import?"}
    >
      {/* on its own line on phones, so the two answers stay together */}
      <span className="upto-520:basis-full">
        {cancel ? "Cancel and clear the list?" : "Stop and clear?"}
      </span>
      <button
        type="button"
        className={styles.stopYes}
        onClick={() => useBookImport.getState().stop()}
      >
        Yes
      </button>
      <button
        type="button"
        className={styles.stop}
        autoFocus
        onClick={() => setAsking(false)}
      >
        {cancel ? "Keep it" : "Keep going"}
      </button>
    </span>
  );
}

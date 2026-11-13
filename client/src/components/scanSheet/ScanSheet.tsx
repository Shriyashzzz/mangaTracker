// Scan the barcodes on the back of volumes to put them on the shelf: each one
// is marked theirs, or its series is added with it (lib/scan.ts). The camera
// stays open for a whole stack; what each scan came to stacks up below, within
// thumb reach, each with its undo. No camera, or it's refused: type the ISBN.
// A native dialog, so focus stays inside and Escape closes it.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";
import { BarcodeIcon, CheckIcon, CloseIcon, TorchIcon } from "../icons/Icons";
import { isbnFromTyped } from "../../lib/barcode";
import { editScan, shelveScan, type ScanResult } from "../../lib/scan";
import ScanEdit from "./ScanEdit";
import { useShelf } from "../../store/shelf";
import { useBarcodeReader } from "./useBarcodeReader";
import { scanStyles as styles } from "./styles";

// one scanned book: looking it up until result arrives
type Row = {
  key: number;
  isbn: string;
  result?: ScanResult;
  undone?: boolean;
  undoFailed?: boolean;
};

// "Vol. 3", or "Vols. 17–18" for a book holding two
const volumesLabel = (volumes: number[]) =>
  volumes.length > 1
    ? `Vols. ${volumes[0]}–${volumes[volumes.length - 1]}`
    : `Vol. ${volumes[0]}`;

// a short high beep, as a till's scanner makes, when a book goes on the shelf.
// Phones only let a page make sound after a tap, so the scanner unlocks it on
// the first one; until then it's silent
function beep(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return;
  const tone = ctx.createOscillator();
  const level = ctx.createGain();
  tone.frequency.value = 1760;
  level.gain.setValueAtTime(0.12, ctx.currentTime);
  level.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  tone.connect(level).connect(ctx.destination);
  tone.start();
  tone.stop(ctx.currentTime + 0.12);
}

// how long "Already scanned" stays under the frame
const NOTICE_MS = 1600;

const landed = (row: Row) =>
  !row.undone &&
  (row.result?.kind === "marked" || row.result?.kind === "added");

// what a scan came to, said big over the camera for a moment: its colour
// and its words
function flashFor(kind: ScanResult["kind"]): {
  tone: "good" | "same" | "bad";
  note: string;
} {
  if (kind === "marked" || kind === "added")
    return { tone: "good", note: "On your shelf" };
  if (kind === "already") return { tone: "same", note: "Already yours" };
  if (kind === "unknown")
    return { tone: "bad", note: "Couldn't find this one" };
  return { tone: "bad", note: "That didn't save" };
}

export default function ScanSheet({
  onClose,
  isbn: firstIsbn,
}: {
  onClose: () => void;
  // typed into the add form's title box: looked up as soon as it opens
  isbn?: string;
}) {
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const isbnField = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [typing, setTyping] = useState(false);
  const [typedError, setTypedError] = useState("");
  const [justRead, setJustRead] = useState(false);
  const [notice, setNotice] = useState("");
  // what the last scan came to, big over the camera for a moment, and which
  // row it is in the list
  const [flash, setFlash] = useState<null | {
    tone: "good" | "same" | "bad";
    title: string;
    note: string;
  }>(null);
  const [newest, setNewest] = useState<number | null>(null);
  // the row being corrected in ScanEdit
  const [editing, setEditing] = useState<number | null>(null);
  const sound = useRef<AudioContext | null>(null);
  const [attempt, setAttempt] = useState(0);
  // one scan at a time, in order: two volumes of a new series scanned in a
  // row must find the series the first one added
  const queue = useRef(Promise.resolve());
  const handled = useRef(new Set<string>());
  const changed = useRef(false);
  const nextKey = useRef(0);
  const timers = useRef<number[]>([]);

  // the beep's sound, ready from the tap that opened the scanner, or the next
  useEffect(() => {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    sound.current = ctx;
    const unlock = () => void ctx.resume().catch(() => {});
    unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      void ctx.close().catch(() => {});
      sound.current = null;
    };
  }, []);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const read = useCallback((isbn: string) => {
    const later = (fn: () => void, ms: number) =>
      timers.current.push(window.setTimeout(fn, ms));
    setJustRead(true);
    later(() => setJustRead(false), 350);
    try {
      navigator.vibrate?.(40);
    } catch {
      /* no buzz on this device */
    }
    // the same book twice in one sitting does nothing new, but says so
    if (handled.current.has(isbn)) {
      setNotice("Already scanned");
      later(() => setNotice(""), NOTICE_MS);
      return;
    }
    handled.current.add(isbn);
    const key = nextKey.current++;
    // shown at once, so a slow lookup never looks like a missed scan
    setRows((now) => [{ key, isbn }, ...now]);
    queue.current = queue.current.then(async () => {
      const result = await shelveScan(isbn);
      if (result.kind === "marked" || result.kind === "added")
        changed.current = true;
      // a failure can be scanned again
      if (result.kind === "failed") handled.current.delete(isbn);
      setRows((now) => now.map((r) => (r.key === key ? { ...r, result } : r)));
      setNewest(key);
      const name =
        "book" in result
          ? `${result.name} · ${volumesLabel(result.book.volumes)}`
          : result.isbn;
      setFlash({ title: name, ...flashFor(result.kind) });
      timers.current.push(window.setTimeout(() => setFlash(null), 1800));
      if (result.kind === "marked" || result.kind === "added")
        beep(sound.current);
    });
  }, []);

  useEffect(() => {
    if (!firstIsbn) return;
    const soon = window.setTimeout(() => read(firstIsbn));
    return () => clearTimeout(soon);
  }, [firstIsbn, read]);

  // a price barcode, not the book's: said for a few seconds, not every frame
  const otherBarcode = useCallback(() => {
    setNotice((now) => {
      if (now) return now;
      timers.current.push(window.setTimeout(() => setNotice(""), 3500));
      return "That's the price barcode. Scan the ISBN one, its number starts 978 or 979";
    });
  }, []);
  const camera = useBarcodeReader(video, read, !typing, attempt, otherBarcode);
  const showTyping = typing || camera.state === "blocked";

  // typing opens with the box ready
  useEffect(() => {
    if (showTyping) isbnField.current?.focus();
  }, [showTyping]);

  const close = () => {
    // the shelf's cards say what they own, so it reloads once at the end
    if (changed.current) void useShelf.getState().load();
    onClose();
  };

  const undo = async (row: Row) => {
    if (row.result?.kind !== "marked" && row.result?.kind !== "added") return;
    const { book } = row.result;
    try {
      await row.result.undo();
      handled.current.delete(book.isbn13);
      setRows((now) =>
        now.map((r) =>
          r.key === row.key ? { ...r, undone: true, undoFailed: false } : r,
        ),
      );
    } catch {
      setRows((now) =>
        now.map((r) => (r.key === row.key ? { ...r, undoFailed: true } : r)),
      );
    }
  };

  const submitTyped = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const field = isbnField.current!;
    const isbn = isbnFromTyped(field.value);
    if (!isbn) {
      setTypedError(
        "That isn't an ISBN. It's the 13 digits under the barcode.",
      );
      return;
    }
    setTypedError("");
    field.value = "";
    // typed on purpose: looked up again even if scanned before
    handled.current.delete(isbn);
    read(isbn);
  };

  const onShelf = rows.filter(landed).length;

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${showTyping ? "" : styles.dialogCamera}`}
      aria-label="Scan a barcode"
      // its own close only: the Edit dialog inside it closes too, and React
      // passes that up through the tree
      onClose={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.top}>
        <button
          type="button"
          className={styles.round}
          aria-label="Close the scanner"
          onClick={() => dialog.current?.close()}
        >
          <CloseIcon />
        </button>
        <h2 className={styles.title}>Scan</h2>
        <button
          type="button"
          className={styles.round}
          aria-label="Torch"
          aria-pressed={camera.torch.on}
          disabled={!camera.torch.can || showTyping}
          onClick={camera.toggleTorch}
        >
          <TorchIcon />
        </button>
      </div>

      <div className={showTyping ? styles.cameraTyping : styles.camera}>
        {!showTyping && (
          <>
            <video ref={video} className={styles.video} muted playsInline />
            <div className={styles.frame} data-read={justRead || undefined}>
              {/* only once it's really looking */}
              {camera.state === "live" && <span className={styles.laser} />}
            </div>
            {flash && (
              <div
                className={`${styles.flash} ${flash.tone === "good" ? styles.flashGood : flash.tone === "bad" ? styles.flashBad : ""}`}
                role="status"
              >
                {flash.tone === "good" && (
                  <CheckIcon className="mx-auto size-7" aria-hidden />
                )}
                <b className="block truncate">{flash.title}</b>
                <span className="text-[0.88rem]">{flash.note}</span>
              </div>
            )}
            <p className={styles.hint} role="status">
              {camera.state === "starting"
                ? "Starting the camera…"
                : notice || "Point at the barcode on the back"}
              <small className={styles.hintSmall}>
                It reads on its own. Keep going for a whole stack
              </small>
            </p>
          </>
        )}
        {showTyping && (
          <div className={styles.blocked}>
            <BarcodeIcon className="mx-auto size-10" />
            <p className="m-0">
              {camera.state === "blocked"
                ? "The camera's off for this site. Allow it in the browser's site settings, or type the 13 digits under the barcode."
                : "Type the 13 digits under the barcode."}
            </p>
            {camera.state === "blocked" && (
              <button
                type="button"
                className={styles.retry}
                onClick={() => {
                  setTyping(false);
                  setAttempt((n) => n + 1);
                }}
              >
                Try the camera again
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.results}>
        <div
          className={showTyping ? styles.listTall : styles.list}
          aria-live="polite"
        >
          {!rows.length && (
            <p className={styles.empty}>Scanned volumes show up here.</p>
          )}
          {rows.map((row) => (
            <ScanRow
              key={row.key}
              row={row}
              onUndo={() => void undo(row)}
              isNew={row.key === newest}
              onAddByTitle={() => {
                dialog.current?.close();
                navigate("/add", { viewTransition: true });
              }}
              // what was scanned is already saved: Edit corrects its series
              // or volumes in place (ScanEdit)
              onEdit={() => setEditing(row.key)}
              onRetry={() => read(row.isbn)}
            />
          ))}
        </div>

        {showTyping && (
          <form className={styles.typed} onSubmit={submitTyped} noValidate>
            <label htmlFor="scan-isbn" className="sr-only">
              ISBN
            </label>
            <input
              ref={isbnField}
              id="scan-isbn"
              className={styles.input}
              inputMode="numeric"
              autoComplete="off"
              placeholder="978…"
              aria-invalid={Boolean(typedError) || undefined}
              aria-describedby={typedError ? "scan-isbn-error" : undefined}
            />
            <button type="submit" className="btn btn-secondary min-h-12">
              Find
            </button>
            {typedError && (
              <p id="scan-isbn-error" className={styles.typedError}>
                {typedError}
              </p>
            )}
          </form>
        )}

        <div className={styles.footer}>
          {camera.state !== "blocked" && (
            <button
              type="button"
              className={styles.link}
              onClick={() => setTyping((on) => !on)}
            >
              {typing ? "Use the camera" : "Type the ISBN"}
            </button>
          )}
          <span className={`${styles.count} ml-auto`}>
            {rows.length} scanned · {onShelf} added
          </span>
        </div>
        <button
          type="button"
          className={styles.done}
          onClick={() => dialog.current?.close()}
        >
          Done
        </button>
      </div>
      {(() => {
        const row = rows.find((r) => r.key === editing);
        const result = row?.result;
        if (!row || !result || !("book" in result)) return null;
        return (
          <ScanEdit
            name={result.name}
            volumes={result.book.volumes}
            id={result.id}
            onClose={() => setEditing(null)}
            onSave={async (change) => {
              const next = await editScan(result, change);
              if (next.kind === "failed") throw new Error("not saved");
              changed.current = true;
              setRows((now) =>
                now.map((r) =>
                  r.key === row.key
                    ? { ...r, result: next, undone: false, undoFailed: false }
                    : r,
                ),
              );
            }}
          />
        );
      })()}
    </dialog>
  );
}

// what one scan came to
function ScanRow({
  row,
  isNew,
  onUndo,
  onAddByTitle,
  onEdit,
  onRetry,
}: {
  row: Row;
  isNew: boolean;
  onUndo: () => void;
  onAddByTitle: () => void;
  onEdit: () => void;
  onRetry: () => void;
}) {
  const { result } = row;
  if (!result)
    return (
      <div className={styles.row}>
        <span className="min-w-0">
          <b className={styles.rowTitle}>{row.isbn}</b>
          <small className={styles.rowNote}>Looking it up…</small>
        </span>
      </div>
    );
  const title =
    "book" in result
      ? `${result.name} · ${volumesLabel(result.book.volumes)}`
      : row.isbn;
  // what happened to this scan, in words: an undo first, then how it went
  let note = "That didn't save";
  if (row.undoFailed) note = "Undo didn't save. Try again";
  else if (row.undone) note = "Undone";
  else if (result.kind === "marked") note = "Marked yours";
  else if (result.kind === "added")
    note = `Added to your shelf with ${volumesLabel(result.book.volumes)}`;
  else if (result.kind === "already") note = "Already yours";
  else if (result.kind === "unknown") note = "Couldn't find this one";
  const good = landed(row) && !row.undoFailed;
  const bad =
    row.undoFailed || result.kind === "unknown" || result.kind === "failed";
  return (
    <div className={`${styles.row} ${isNew ? styles.rowNew : ""}`}>
      <span className="min-w-0">
        <b className={styles.rowTitle}>{title}</b>
        <small
          className={`${styles.rowNote} ${good ? styles.rowGood : bad ? styles.rowBad : ""}`}
        >
          {good && <CheckIcon className="size-3.5 shrink-0" />}
          {note}
        </small>
      </span>
      <span className={styles.rowActions}>
        {landed(row) && (
          <button type="button" className={styles.link} onClick={onUndo}>
            Undo
          </button>
        )}
        {"id" in result && !row.undone && (
          <button type="button" className={styles.link} onClick={onEdit}>
            Edit
          </button>
        )}
        {result.kind === "unknown" && (
          <button type="button" className={styles.link} onClick={onAddByTitle}>
            Add by title
          </button>
        )}
        {result.kind === "failed" && (
          <button type="button" className={styles.link} onClick={onRetry}>
            Try again
          </button>
        )}
      </span>
    </div>
  );
}

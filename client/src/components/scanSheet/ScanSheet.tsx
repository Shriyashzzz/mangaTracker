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
import { BarcodeIcon, CheckIcon, CloseIcon, TorchIcon } from "../icons/Icons";
import { isbnFromTyped } from "../../lib/barcode";
import { shelveScan, type ScanResult } from "../../lib/scan";
import { useShelf } from "../../store/shelf";
import { useBarcodeReader } from "./useBarcodeReader";
import { scanStyles as styles } from "./styles";

type Row = { key: number; result: ScanResult; undone?: boolean };

const what = (result: ScanResult) =>
  "book" in result
    ? `${result.name} · Vol. ${result.book.volume}`
    : result.isbn;

export default function ScanSheet({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [typing, setTyping] = useState(false);
  const [typedError, setTypedError] = useState("");
  const [justRead, setJustRead] = useState(false);
  // one scan at a time, in order: two volumes of a new series scanned in a
  // row must find the series the first one added
  const queue = useRef(Promise.resolve());
  const handled = useRef(new Set<string>());
  const changed = useRef(false);
  const nextKey = useRef(0);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const shelve = useCallback((isbn: string) => {
    // the same book twice in one sitting does nothing new
    if (handled.current.has(isbn)) return;
    handled.current.add(isbn);
    setJustRead(true);
    setTimeout(() => setJustRead(false), 350);
    try {
      navigator.vibrate?.(40);
    } catch {
      /* no buzz on this device */
    }
    queue.current = queue.current.then(async () => {
      const result = await shelveScan(isbn);
      if (result.kind === "marked" || result.kind === "added")
        changed.current = true;
      // a failure can be scanned again
      if (result.kind === "failed") handled.current.delete(isbn);
      setRows((now) => [{ key: nextKey.current++, result }, ...now]);
    });
  }, []);

  const camera = useBarcodeReader(video, shelve, !typing);
  const showTyping = typing || camera.state === "blocked";

  const close = () => {
    // the shelf's cards say what they own, so it reloads once at the end
    if (changed.current) void useShelf.getState().load();
    onClose();
  };

  const undo = async (row: Row) => {
    if (row.result.kind !== "marked" && row.result.kind !== "added") return;
    await row.result.undo();
    if ("book" in row.result) handled.current.delete(row.result.book.isbn13);
    setRows((now) =>
      now.map((r) => (r.key === row.key ? { ...r, undone: true } : r)),
    );
  };

  const submitTyped = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const field = e.currentTarget.elements.namedItem(
      "isbn",
    ) as HTMLInputElement;
    const isbn = isbnFromTyped(field.value);
    if (!isbn) {
      setTypedError(
        "That isn't an ISBN. It's the 13 digits under the barcode.",
      );
      return;
    }
    setTypedError("");
    field.value = "";
    handled.current.delete(isbn);
    shelve(isbn);
  };

  const scanned = rows.length;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label="Scan a barcode"
      onClose={close}
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

      <div className={styles.camera}>
        {!showTyping && (
          <>
            <video ref={video} className={styles.video} muted playsInline />
            <div className={styles.frame} data-read={justRead || undefined}>
              <span className={styles.laser} />
            </div>
            <p className={styles.hint}>
              {camera.state === "starting"
                ? "Starting the camera…"
                : "Point at the barcode on the back"}
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
                ? "The camera's off for this site. Type the ISBN from the back instead: the 13 digits under the barcode."
                : "Type the 13 digits under the barcode."}
            </p>
          </div>
        )}
      </div>

      <div className={styles.results}>
        <div className={styles.list} aria-live="polite">
          {!rows.length && (
            <p className={styles.empty}>Scanned volumes show up here.</p>
          )}
          {rows.map((row) => (
            <ScanRow
              key={row.key}
              row={row}
              onUndo={() => void undo(row)}
              onType={() => setTyping(true)}
              onRetry={() => "isbn" in row.result && shelve(row.result.isbn)}
            />
          ))}
        </div>

        {showTyping && (
          <form className={styles.typed} onSubmit={submitTyped} noValidate>
            <label htmlFor="scan-isbn" className="sr-only">
              ISBN
            </label>
            <input
              id="scan-isbn"
              name="isbn"
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
          <span className={`${styles.count} ml-auto`}>{scanned} scanned</span>
        </div>
        <button
          type="button"
          className={styles.done}
          onClick={() => dialog.current?.close()}
        >
          Done
        </button>
      </div>
    </dialog>
  );
}

// what one scan came to
function ScanRow({
  row,
  onUndo,
  onType,
  onRetry,
}: {
  row: Row;
  onUndo: () => void;
  onType: () => void;
  onRetry: () => void;
}) {
  const { result } = row;
  const note = row.undone
    ? "Undone"
    : result.kind === "marked"
      ? "Marked yours"
      : result.kind === "added"
        ? `Added to your shelf with Vol. ${result.book.volume}`
        : result.kind === "already"
          ? "Already yours"
          : result.kind === "unknown"
            ? "Couldn't find this one"
            : "That didn't save";
  const good =
    !row.undone && (result.kind === "marked" || result.kind === "added");
  const bad = result.kind === "unknown" || result.kind === "failed";
  return (
    <div className={styles.row}>
      <span className="min-w-0">
        <b className={styles.rowTitle}>{what(result)}</b>
        <small
          className={`${styles.rowNote} ${good ? styles.rowGood : bad ? styles.rowBad : ""}`}
        >
          {good && <CheckIcon className="size-3.5 shrink-0" />}
          {note}
        </small>
      </span>
      {good && (
        <button type="button" className={styles.link} onClick={onUndo}>
          Undo
        </button>
      )}
      {result.kind === "unknown" && (
        <button type="button" className={styles.link} onClick={onType}>
          Type it
        </button>
      )}
      {result.kind === "failed" && (
        <button type="button" className={styles.link} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

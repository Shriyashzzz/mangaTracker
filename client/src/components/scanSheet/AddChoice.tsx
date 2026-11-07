// What the phones' round + opens: add a series by typing its title, or scan
// the barcodes on a stack of volumes. A sheet from the bottom, in thumb reach;
// a native dialog, so Escape and a tap outside close it.
import { useEffect, useRef } from "react";
import { BarcodeIcon, TypeIcon } from "../icons/Icons";

const choice =
  "grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 border-2 border-line bg-paper p-3 text-left text-ink hover:bg-accent-wash [&_svg]:size-7";

export default function AddChoice({
  onType,
  onScan,
  onClose,
}: {
  onType: () => void;
  onScan: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    // the scanner's code starts loading now, so Scan opens without a wait
    void import("./ScanSheet");
  }, []);
  // whichever is picked, the sheet goes first
  const pick = (then: () => void) => () => {
    dialog.current?.close();
    then();
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby="add-choice-title"
      onClose={onClose}
      // a tap on the dimmed page around it closes it
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
      className="mx-0 mt-auto mb-0 w-screen max-w-none animate-card-in border-0 border-t-[3px] border-line bg-card p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink backdrop:bg-[rgba(20,14,8,0.45)] open:grid open:gap-2.5 motion-reduce:animate-none"
    >
      <h2
        id="add-choice-title"
        className="m-0 font-brand text-[1.5rem] leading-none font-normal tracking-[0.02em] uppercase"
      >
        Add manga
      </h2>
      <button type="button" className={choice} onClick={pick(onType)}>
        <TypeIcon />
        <span>
          <b className="block font-semibold">Type a title</b>
          <small className="text-ink-soft">
            Search by name, add the chapter you're on
          </small>
        </span>
      </button>
      <button type="button" className={choice} onClick={pick(onScan)}>
        <BarcodeIcon />
        <span>
          <b className="block font-semibold">Scan a barcode</b>
          <small className="text-ink-soft">
            Point at the back of a volume, scan a stack in a row
          </small>
        </span>
      </button>
      <button
        type="button"
        className="tap mx-auto min-h-11 px-2 text-[0.95rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink"
        onClick={() => dialog.current?.close()}
      >
        Cancel
      </button>
    </dialog>
  );
}

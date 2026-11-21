// A form folded away under a line ("Missing a book?", "Is this wrong?
// Suggest a fix"): on the website, a fold that opens in the page; in the app
// (lib/inApp.ts), the line opens the same form in a bottom sheet, as an
// Android app asks (index.css .app-sheet-dialog). Back, Escape or a tap on
// the dimmed page closes it.
import { useRef, useState, type ReactNode } from "react";
import { inApp } from "../../lib/inApp";

type Props = {
  // the line that opens it, and its look
  summary: ReactNode;
  summaryClass: string;
  // the fold's own look on the website
  className: string;
  // open from the start (website only: a sheet never opens by itself)
  open?: boolean;
  // the sheet's heading in the app, when the line isn't one ("Missing a book?")
  title?: string;
  children: ReactNode;
};

export default function AppFold({
  summary,
  summaryClass,
  className,
  open = false,
  title,
  children,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);
  if (!inApp())
    return (
      <details className={className} open={open}>
        <summary className={summaryClass}>{summary}</summary>
        {children}
      </details>
    );
  return (
    <div className={className}>
      <button
        type="button"
        className={summaryClass}
        aria-haspopup="dialog"
        onClick={() => {
          setShown(true);
          // drawn first, then opened as a modal
          requestAnimationFrame(() => dialog.current?.showModal());
        }}
      >
        {summary}
      </button>
      {shown && (
        <dialog
          ref={dialog}
          className="app-sheet-dialog app-fold-sheet"
          aria-label={title ?? (typeof summary === "string" ? summary : "")}
          onClose={() => setShown(false)}
          onClick={(e) => {
            if (e.target === dialog.current) dialog.current.close();
          }}
        >
          <div className="app-fold-body">
            <h2 className="app-fold-title">{title ?? summary}</h2>
            {children}
          </div>
        </dialog>
      )}
    </div>
  );
}

// What a row of "Your books" can do besides its price and date, kept off the
// row itself (BookRow.tsx): a ⋮ menu (Lend…, Got it back, Remove book), the
// lend question, and the question before removing several at once. In the
// app the menu is a bottom sheet (index.css .app-sheet) and the dialogs are
// Android's (.app-dialog); on the website, a small menu and the shelf's own
// dialog look (pages/Home/DeleteManyModal.tsx)
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  HandIcon,
  MoreIcon,
  ReturnIcon,
  TrashIcon,
} from "../../components/icons/Icons";
import { useCloseOnBack } from "../../lib/closeOnBack";
import { swallowClosingTap } from "../../lib/inApp";
import { orOffline } from "../../lib/offline";
import { homeStyles as dialog } from "../Home/styles";
import { detailsStyles as styles } from "./styles";

// ---------- the ⋮ menu ----------

export function BookMenu({
  name,
  lentTo,
  onLend,
  onBack,
  onRemove,
}: {
  // "Omnibus 11 · vols. 31–33"
  name: string;
  lentTo: string | null;
  onLend: () => void;
  onBack: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current?.contains(e.target as Node)) return;
      swallowClosingTap(e.target);
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useCloseOnBack(open, () => setOpen(false));
  const choose = (act: () => void) => () => {
    setOpen(false);
    act();
  };
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        className={styles.bookMore}
        aria-label={`More for ${name}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MoreIcon className="size-5" />
      </button>
      {open && (
        <ul className={`${styles.bookMenu} app-sheet`} aria-label={name}>
          <li className={styles.bookMenuHead} aria-hidden>
            {name}
          </li>
          {lentTo && (
            <MenuItem icon={<ReturnIcon />} onClick={choose(onBack)}>
              Got it back from {lentTo}
            </MenuItem>
          )}
          <MenuItem icon={<HandIcon />} onClick={choose(onLend)}>
            {lentTo ? "Lend to someone else…" : "Lend…"}
          </MenuItem>
          <MenuItem icon={<TrashIcon />} danger onClick={choose(onRemove)}>
            Remove book
          </MenuItem>
        </ul>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  danger = false,
  onClick,
  children,
}: {
  icon: ReactNode;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        className={danger ? styles.bookMenuDanger : styles.bookMenuItem}
        onClick={onClick}
      >
        <span className={styles.bookMenuIcon} aria-hidden>
          {icon}
        </span>
        {children}
      </button>
    </li>
  );
}

// ---------- a dialog, as the shelf draws its delete one ----------

function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return {
    ref,
    className: `${dialog.confirm} app-dialog`,
    onClose,
    // the backdrop counts as the dialog itself
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === ref.current) ref.current.close();
    },
  };
}

// "Who has Omnibus 12?": one name for one book or several, with the names
// they've lent to before a tap away
export function LendDialog({
  what,
  pastNames,
  onLend,
  onClose,
}: {
  // "Omnibus 12", "3 books"
  what: string;
  pastNames: string[];
  onLend: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const props = useDialog(onClose);
  const [who, setWho] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const lend = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setFailed(false);
    if (await onLend(trimmed)) props.ref.current?.close();
    else {
      setFailed(true);
      setSaving(false);
    }
  };
  return (
    <dialog {...props} aria-labelledby="lend-title">
      <form
        className={dialog.confirmBox}
        onSubmit={(e) => {
          e.preventDefault();
          void lend(who);
        }}
      >
        <h2 id="lend-title" className={dialog.confirmTitle}>
          Who has {what}?
        </h2>
        <input
          className={styles.lendInput}
          placeholder="A name"
          aria-label="Who has it"
          maxLength={40}
          autoFocus
          value={who}
          onChange={(e) => setWho(e.target.value)}
        />
        {pastNames.length > 0 && (
          <div className={styles.lendNames}>
            {pastNames.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.lendName}
                disabled={saving}
                onClick={() => void lend(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        {failed && (
          <p className={dialog.confirmError} role="alert">
            {orOffline("That didn't save. Try again.")}
          </p>
        )}
        <div className={dialog.confirmActions}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() => props.ref.current?.close()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !who.trim()}
          >
            {saving ? "Saving…" : "Lend"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// "Remove 3 books?": what goes, before it goes
export function RemoveBooksDialog({
  count,
  names,
  volumes,
  onRemove,
  onClose,
}: {
  count: number;
  // "Omnibus 10, 11 and 12", and "vols. 28–36"
  names: string;
  volumes: string;
  onRemove: () => Promise<boolean>;
  onClose: () => void;
}) {
  const props = useDialog(onClose);
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const remove = async () => {
    setRemoving(true);
    setFailed(false);
    if (await onRemove()) props.ref.current?.close();
    else {
      setFailed(true);
      setRemoving(false);
    }
  };
  const books = count === 1 ? "book" : `${count} books`;
  return (
    <dialog
      {...props}
      aria-labelledby="remove-books-title"
      onCancel={(e) => {
        if (removing) e.preventDefault();
      }}
    >
      <div className={dialog.confirmBox}>
        <h2 id="remove-books-title" className={dialog.confirmTitle}>
          Remove {count === 1 ? "this book" : books}?
        </h2>
        <p className={dialog.confirmBody}>
          {names} {count === 1 ? "comes" : "come"} off your shelf, with{" "}
          {volumes}.
        </p>
        {failed && (
          <p className={dialog.confirmError} role="alert">
            {orOffline("That didn't remove them. Try again.")}
          </p>
        )}
        <div className={dialog.confirmActions}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={removing}
            onClick={() => props.ref.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={removing}
            onClick={remove}
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

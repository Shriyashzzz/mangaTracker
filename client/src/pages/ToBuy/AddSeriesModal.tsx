// "Add it to your shelf?": after On my shelf or Ordered on To buy, for a
// series that isn't on the shelf. Its name, cleaned from the store's title
// and theirs to correct (nothing is added under a name they didn't see), To
// read or Reading (To read unless they say: it's new to the shelf), and
// "Don't ask again" (Settings, Your shelf, turns it back on). The server
// adds it with the book's volumes when they're certain, or puts them on the
// series already there by that name (server toBuy.ts addFromToBuy).
// The dialog the list's "Clear your To buy list?" is (native: focus trap,
// Escape, backdrop), with its styles.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { homeStyles as styles } from "../Home/styles";
import { savePrefs } from "../../lib/prefs";
import { novelParts } from "../../lib/prices";
import {
  addSeriesFromToBuy,
  type AddedFromToBuy,
  type Settled,
  type ToBuyItem,
} from "../../lib/toBuy";
import { useAuth } from "../../store/auth";

type Props = {
  item: ToBuyItem;
  settled: Settled;
  how: "owned" | "ordered";
  // the book's own name, as the list says it
  bookName: string;
  // added (or put on the one there); null: not now
  onDone: (added: AddedFromToBuy | null) => void;
};

const field =
  "w-full border-[1.5px] border-line bg-card px-3 py-2 text-[1rem] text-ink focus:outline-2 focus:outline-offset-2 focus:outline-accent";

export default function AddSeriesModal({
  item,
  settled,
  how,
  bookName,
  onDone,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [name, setName] = useState(() => novelParts(settled.series).title);
  const [planned, setPlanned] = useState(true);
  const [dontAsk, setDontAsk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState("");
  // what the dialog ends with, said to the page once it's closed
  const result = useRef<AddedFromToBuy | null>(null);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  // "Don't ask again", whichever way it closes
  const close = () => {
    if (dontAsk) savePrefs({ offerAdd: "off" }, isSignedIn);
    dialog.current?.close();
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFailed("");
    try {
      result.current = await addSeriesFromToBuy(item.isbn13, {
        name: name.trim(),
        planned,
        how,
      });
      close();
    } catch (error) {
      setFailed((error as Error).message);
      setSaving(false);
    }
  };

  const sure = Boolean(settled.volumes?.length);
  return (
    <dialog
      ref={dialog}
      className={styles.confirm}
      aria-labelledby="add-series-title"
      onClose={() => onDone(result.current)}
      onCancel={(e) => {
        // not while it's saving: the page has to hear how it went
        if (saving) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !saving) close();
      }}
    >
      <form className={styles.confirmBox} onSubmit={add} noValidate>
        <h2 id="add-series-title" className={styles.confirmTitle}>
          Add it to your shelf?
        </h2>
        <p className={styles.confirmBody}>
          {bookName} is {how === "owned" ? "yours" : "ordered"}, but its series
          isn't on your shelf yet.
        </p>
        <label className="mt-4 block text-[0.85rem] font-medium text-ink-soft">
          Series name
          <input
            className={`${field} mt-1`}
            value={name}
            maxLength={150}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </label>
        <fieldset className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
          <legend className="mb-1 text-[0.85rem] font-medium text-ink-soft">
            Put it in
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="add-series-status"
              checked={planned}
              onChange={() => setPlanned(true)}
              disabled={saving}
            />
            To read
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="add-series-status"
              checked={!planned}
              onChange={() => setPlanned(false)}
              disabled={saving}
            />
            Reading
          </label>
        </fieldset>
        {!sure && (
          <p className={styles.confirmBody}>
            We can't tell which volumes it holds: tick them on its page after.
          </p>
        )}
        <label className="mt-4 flex items-center gap-2 text-[0.9rem] text-ink-soft">
          <input
            type="checkbox"
            checked={dontAsk}
            onChange={(e) => setDontAsk(e.target.checked)}
            disabled={saving}
          />
          Don't ask again
        </label>
        {failed && (
          <p className={styles.confirmError} role="alert">
            {failed}
          </p>
        )}
        <div className={styles.confirmActions}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={close}
          >
            Not now
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? "Adding…" : "Add to my shelf"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

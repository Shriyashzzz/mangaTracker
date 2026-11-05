// Which volumes they own, on the add and edit forms. Most own a run from the
// first, so the quick way stays: "Own up to vol. 14". "Pick exact volumes"
// opens a panel of numbered tickets to tap (One Piece 1 and 4), or a box to
// type them in ("1-5, 8"). The field sits in the form's row of small fields;
// the panel needs the full width, so the form places it under that row.
// The form reads `volumesOwned` and `ownedList` (comma separated) from its
// fields, as it reads everything else.
import { useId, useState, type ReactNode } from "react";
import {
  ownedOf,
  ownedVolumes,
  parseVolumes,
  rangesText,
} from "../../lib/ownedVolumes";
import { formStyles } from "../../styles/form";
import { volumePickerStyles as styles } from "./styles";

// tickets shown to start with, and how many more each tap adds
const FIRST_SHOWN = 12;
const MORE = 12;

export function useVolumePicker(start: {
  volumesOwned: number | null;
  ownedList?: number[];
}): {
  field: ReactNode;
  panel: ReactNode;
  // the edit form's manga arrives after the page: start from it
  reset: (to: { volumesOwned: number | null; ownedList?: number[] }) => void;
} {
  const [upTo, setUpTo] = useState(
    start.volumesOwned ? String(start.volumesOwned) : "",
  );
  const [picked, setPicked] = useState<number[]>(start.ownedList ?? []);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const [typedBad, setTypedBad] = useState(false);
  const highest = picked[picked.length - 1] ?? 0;
  const [shown, setShown] = useState(() =>
    Math.max(
      FIRST_SHOWN,
      Math.ceil((Math.max(highest, Number(upTo) || 0) + 1) / 6) * 6,
    ),
  );
  const panelId = useId();
  const inputId = useId();
  const exact = picked.length > 0;

  // the run from 1 they said, as tickets, when they start picking
  const startPicking = () => {
    if (!exact) {
      const run = ownedOf({ volumesOwned: Number(upTo) || null });
      setPicked(run);
      setShown((s) => Math.max(s, Math.ceil((run.length + 1) / 6) * 6));
    }
    setTyped(null);
    setTypedBad(false);
    setOpen(true);
  };
  // done: a run from 1 goes back to being just its number
  const finish = () => {
    const canon = ownedVolumes(null, picked);
    if (!canon.ownedList.length) {
      setUpTo(canon.volumesOwned ? String(canon.volumesOwned) : "");
      setPicked([]);
    }
    setOpen(false);
  };
  const toggle = (v: number) =>
    setPicked((list) =>
      list.includes(v)
        ? list.filter((x) => x !== v)
        : [...list, v].sort((a, b) => a - b),
    );
  const takeTyped = (text: string) => {
    const list = parseVolumes(text);
    setTypedBad(list === null);
    if (!list) return;
    setPicked(list);
    const top = list[list.length - 1] ?? 0;
    setShown((s) => Math.max(s, Math.ceil((top + 1) / 6) * 6));
  };

  const saved = ownedVolumes(Number(upTo) || null, picked);
  const tickets = Array.from(
    { length: Math.max(shown, Math.ceil(highest)) },
    (_, i) => i + 1,
  );
  // volumes like 10.5 that aren't on a ticket
  const offTicket = picked.filter(
    (v) => !Number.isInteger(v) || v > tickets.length,
  );

  const field = (
    <div className={formStyles.field}>
      <label htmlFor={inputId} className={formStyles.label}>
        {exact ? "Volumes you own" : "Own up to vol."}{" "}
        <span className={formStyles.optional}>(optional)</span>
      </label>
      {/* what the form sends, however they said it */}
      <input
        type="hidden"
        name="volumesOwned"
        value={saved.volumesOwned ?? ""}
      />
      <input type="hidden" name="ownedList" value={saved.ownedList.join(",")} />
      {exact ? (
        <output id={inputId} className={styles.picked} aria-live="polite">
          {rangesText(picked)}
        </output>
      ) : (
        <input
          className={formStyles.input}
          inputMode="numeric"
          id={inputId}
          type="number"
          min="1"
          step="1"
          placeholder="e.g. 14"
          value={upTo}
          onChange={(e) => setUpTo(e.target.value)}
        />
      )}
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? finish() : startPicking())}
      >
        {open
          ? "Done picking"
          : exact
            ? "Change volumes"
            : "Pick exact volumes"}
      </button>
    </div>
  );

  const panel = open ? (
    <div
      id={panelId}
      className={styles.panel}
      role="group"
      aria-label="Volumes you own"
    >
      <div className={styles.panelHead}>
        <p className={styles.panelTitle}>
          Tap the volumes you own
          <span className={styles.count}>
            {picked.length ? ` · ${picked.length} picked` : " · none yet"}
          </span>
        </p>
        <div className={styles.quick}>
          <button
            type="button"
            className={styles.quickBtn}
            onClick={() => setPicked(tickets)}
          >
            All 1–{tickets.length}
          </button>
          <button
            type="button"
            className={styles.quickBtn}
            onClick={() => setPicked([])}
          >
            None
          </button>
        </div>
      </div>
      <div className={styles.tickets}>
        {tickets.map((v) => (
          <button
            key={v}
            type="button"
            className={styles.ticket}
            aria-pressed={picked.includes(v)}
            aria-label={`Vol. ${v}`}
            onClick={() => toggle(v)}
          >
            {v}
          </button>
        ))}
        <button
          type="button"
          className={styles.more}
          onClick={() => setShown((s) => s + MORE)}
        >
          +{MORE} more
        </button>
      </div>
      {offTicket.length > 0 && (
        <p className={styles.note}>Also: vol. {rangesText(offTicket)}</p>
      )}
      <label className={styles.typeRow}>
        <span className={styles.typeLabel}>Or type them</span>
        <input
          className={`${formStyles.input} ${styles.typeInput}`}
          placeholder="e.g. 1-5, 8, 10.5"
          value={typed ?? rangesText(picked).replace(/–/g, "-")}
          aria-invalid={typedBad}
          onChange={(e) => {
            setTyped(e.target.value);
            takeTyped(e.target.value);
          }}
          // back to what's picked, which a half-typed range never changed
          onBlur={() => {
            setTyped(null);
            setTypedBad(false);
          }}
        />
      </label>
      {typedBad && (
        <p className={styles.bad} role="alert">
          Use numbers and ranges, like 1-5, 8
        </p>
      )}
    </div>
  ) : null;

  const reset = (to: { volumesOwned: number | null; ownedList?: number[] }) => {
    const list = to.ownedList ?? [];
    setUpTo(to.volumesOwned ? String(to.volumesOwned) : "");
    setPicked(list);
    setOpen(false);
    setTyped(null);
    setTypedBad(false);
    const top = list[list.length - 1] ?? to.volumesOwned ?? 0;
    setShown(Math.max(FIRST_SHOWN, Math.ceil((top + 1) / 6) * 6));
  };

  return { field, panel, reset };
}

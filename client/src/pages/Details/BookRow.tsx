// One row of "Your books": the book's name, who it's lent to (a chip), what
// they paid and the day they bought it. Lend, Got it back and Remove are in
// its ⋮ menu (BookActions.tsx). While selecting several, a tick box takes
// the ⋮'s place; in the app a long press on the row starts selecting. The
// price is saved when they leave the box.
import clsx from "clsx";
import { useState } from "react";
import { centsOf, dayOf } from "../../lib/books";
import { useLongPress } from "../../lib/useLongPress";
import { BookMenu } from "./BookActions";
import { detailsStyles as styles } from "./styles";
import { moneyText, rowName, type BookRow as Row } from "./yourBooksRows";

export type Purchase = {
  paidCents?: number | null;
  boughtOn?: string | null;
  lentTo?: string | null;
};

// "Nov 3", or "Nov 3, 2025" from another year
const sinceText = (day: string) => {
  const date = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(date.getUTCFullYear() === new Date().getFullYear()
      ? {}
      : { year: "numeric" }),
  });
};

type Props = {
  row: Row;
  onSave: (row: Row, change: Purchase) => void;
  onRemove: (row: Row) => void;
  // "Lend…" from its menu: the list asks who (LendDialog)
  onLend: (row: Row) => void;
  // while selecting: whether it's picked, and the tap that picks it
  select?: { picked: boolean; onToggle: () => void };
  // a long press (in the app): selecting starts, with this row picked
  onLongPress?: () => void;
};

export default function BookRow({
  row,
  onSave,
  onRemove,
  onLend,
  select,
  onLongPress,
}: Props) {
  // what's typed in the price box, until it's saved; null: showing the saved one
  const [draft, setDraft] = useState<string | null>(null);
  // what was typed isn't an amount: it stays in the box, and the row says so
  const [notAnAmount, setNotAnAmount] = useState(false);
  const hold = useLongPress(select ? undefined : onLongPress);
  const name = rowName(row);
  const savedCents = row.book?.paidCents ?? null;
  const lentTo = row.book?.lentTo ?? null;
  const lentOn = row.book?.lentOn ?? null;
  const boughtOn = dayOf(row.book?.boughtOn);

  // the text is read from the box itself, so a quick tab away never saves a
  // letter behind
  const savePrice = (text: string) => {
    const typed = text.trim();
    const cents = typed ? centsOf(typed) : null;
    // not an amount ("twelve"): kept as typed, with a word, never dropped
    // without one
    if (typed && cents === null) {
      setNotAnAmount(true);
      return;
    }
    setNotAnAmount(false);
    setDraft(null);
    if (cents === savedCents) return;
    onSave(row, { paidCents: cents });
  };

  return (
    <li
      className={styles.bookRow}
      data-picked={select?.picked || undefined}
      {...hold}
    >
      <div className={styles.bookMain}>
        <div className={styles.bookName}>
          {name}
          {row.book?.isbn13 && (
            <span className={styles.bookIsbn}>ISBN {row.book.isbn13}</span>
          )}
        </div>
        {lentTo && (
          <button
            type="button"
            className={styles.lentChip}
            aria-label={`Lent to ${lentTo}. Got it back?`}
            onClick={() => onSave(row, { lentTo: null })}
          >
            <span aria-hidden>●</span> Lent to {lentTo}
            {lentOn && ` · since ${sinceText(lentOn)}`}
          </button>
        )}
        <div className={styles.bookFields}>
          <label className={styles.bookPaid}>
            <span aria-hidden>$</span>
            <input
              className={styles.bookPaidInput}
              inputMode="decimal"
              placeholder="paid"
              aria-label={`What you paid for ${name}`}
              aria-invalid={notAnAmount || undefined}
              value={draft ?? moneyText(savedCents)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => savePrice(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </label>
          <label className={styles.bookDateWrap}>
            <input
              type="date"
              className={clsx(
                styles.bookDate,
                !boughtOn && styles.bookDateBlank,
              )}
              aria-label={`The day you bought ${name}`}
              value={boughtOn ?? ""}
              max="2099-12-31"
              onChange={(e) =>
                onSave(row, { boughtOn: e.target.value || null })
              }
            />
            {!boughtOn && (
              <span className={styles.bookDateEmpty} aria-hidden>
                Bought on
              </span>
            )}
          </label>
        </div>
        {notAnAmount && (
          <p className={styles.bookPaidWrong} role="alert">
            Type an amount, like 12.99
          </p>
        )}
      </div>
      {select ? (
        <input
          type="checkbox"
          className={styles.bookCheck}
          aria-label={`Select ${name}`}
          checked={select.picked}
          onChange={select.onToggle}
        />
      ) : (
        <BookMenu
          name={name}
          lentTo={lentTo}
          onLend={() => onLend(row)}
          onBack={() => onSave(row, { lentTo: null })}
          onRemove={() => onRemove(row)}
        />
      )}
    </li>
  );
}

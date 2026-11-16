// One row of "Your books": the book's name, what they paid, the day they
// bought it, and Remove. The price is saved when they leave the box.
import { useState } from "react";
import { centsOf, dayOf } from "../../lib/books";
import { detailsStyles as styles } from "./styles";
import { moneyText, rowName, type BookRow as Row } from "./yourBooksRows";

export type Purchase = { paidCents?: number | null; boughtOn?: string | null };

type Props = {
  row: Row;
  onSave: (row: Row, change: Purchase) => void;
  onRemove: (row: Row) => void;
  // the list has a Remove column (every row has one now; kept so a row
  // can still line up without it)
  removeColumn: boolean;
};

export default function BookRow({
  row,
  onSave,
  onRemove,
  removeColumn,
}: Props) {
  // what's typed in the price box, until it's saved; null: showing the saved one
  const [draft, setDraft] = useState<string | null>(null);
  // what was typed isn't an amount: it stays in the box, and the row says so
  const [notAnAmount, setNotAnAmount] = useState(false);
  const name = rowName(row);
  const savedCents = row.book?.paidCents ?? null;

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
    <li className={removeColumn ? styles.bookRow : styles.bookRowPlain}>
      <span className={styles.bookName}>
        {name}
        {row.book?.isbn13 && (
          <span className={styles.bookIsbn}>ISBN {row.book.isbn13}</span>
        )}
      </span>
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
      <input
        type="date"
        className={styles.bookDate}
        aria-label={`The day you bought ${name}`}
        value={dayOf(row.book?.boughtOn) ?? ""}
        max="2099-12-31"
        onChange={(e) => onSave(row, { boughtOn: e.target.value || null })}
      />
      {removeColumn ? (
        <button
          type="button"
          className={styles.bookRemove}
          aria-label={
            row.book
              ? `Remove ${name} and its volumes`
              : `Remove ${name} from your shelf`
          }
          onClick={() => onRemove(row)}
        >
          Remove
        </button>
      ) : null}
      {notAnAmount && (
        <span className={styles.bookPaidWrong} role="alert">
          Type an amount, like 12.99
        </span>
      )}
    </li>
  );
}

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
};

export default function BookRow({ row, onSave, onRemove }: Props) {
  // what's typed in the price box, until it's saved; null: showing the saved one
  const [draft, setDraft] = useState<string | null>(null);
  const name = rowName(row);
  const savedCents = row.book?.paidCents ?? null;

  // the text is read from the box itself, so a quick tab away never saves a
  // letter behind
  const savePrice = (text: string) => {
    setDraft(null);
    const typed = text.trim();
    const cents = typed ? centsOf(typed) : null;
    // nonsense typed: the box goes back to what's saved
    if (typed && cents === null) return;
    if (cents === savedCents) return;
    onSave(row, { paidCents: cents });
  };

  return (
    <li className={styles.bookRow}>
      <span className={styles.bookName}>
        {name}
        {row.book?.isbn13 && (
          <span className={styles.bookIsbn}>ISBN {row.book.isbn13}</span>
        )}
      </span>
      <span className={styles.bookPaid}>
        <span aria-hidden>$</span>
        <input
          className={styles.bookPaidInput}
          inputMode="decimal"
          placeholder="paid"
          aria-label={`What you paid for ${name}`}
          value={draft ?? moneyText(savedCents)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => savePrice(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </span>
      <input
        type="date"
        className={styles.bookDate}
        aria-label={`The day you bought ${name}`}
        value={dayOf(row.book?.boughtOn) ?? ""}
        max="2099-12-31"
        onChange={(e) => onSave(row, { boughtOn: e.target.value || null })}
      />
      {row.book ? (
        <button
          type="button"
          className={styles.bookRemove}
          aria-label={`Remove ${name} and its volumes`}
          onClick={() => onRemove(row)}
        >
          Remove
        </button>
      ) : (
        // a hand-ticked volume is removed on the volume picker; this keeps
        // the columns lined up
        <span className={styles.bookRemoveGap} aria-hidden />
      )}
    </li>
  );
}

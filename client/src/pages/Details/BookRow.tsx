// One row of "Your books": the book's name, what they paid, the day they
// bought it, and Remove. The price is saved when they leave the box. Under
// the name: who it's lent to, or a way to say so.
import { useState } from "react";
import { centsOf, dayOf } from "../../lib/books";
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

// who has it, or a way to say someone does
function Lending({
  name,
  lentTo,
  lentOn,
  onSave,
}: {
  name: string;
  lentTo: string | null;
  lentOn: string | null;
  onSave: (lentTo: string | null) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [who, setWho] = useState("");
  const link =
    "tap text-[0.78rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:decoration-current";
  if (lentTo)
    return (
      <span className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[0.8rem] text-accent-ink">
        Lent to {lentTo}
        {lentOn && ` since ${sinceText(lentOn)}`}
        <button type="button" className={link} onClick={() => onSave(null)}>
          Got it back
        </button>
      </span>
    );
  if (!asking)
    return (
      <button
        type="button"
        className={`${link} mt-1 block`}
        onClick={() => setAsking(true)}
      >
        Lend
      </button>
    );
  const save = () => {
    const name = who.trim();
    setAsking(false);
    setWho("");
    if (name) onSave(name);
  };
  return (
    <span className="mt-1 flex items-center gap-2">
      <input
        className="w-36 border-b-[1.5px] border-line-soft bg-transparent text-[0.85rem] focus:border-line focus:outline-none"
        placeholder="Who has it?"
        aria-label={`Who you lent ${name} to`}
        maxLength={40}
        autoFocus
        value={who}
        onChange={(e) => setWho(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setAsking(false);
        }}
      />
      <button type="button" className={link} onClick={save}>
        Save
      </button>
    </span>
  );
}

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
        <Lending
          name={name}
          lentTo={row.book?.lentTo ?? null}
          lentOn={row.book?.lentOn ?? null}
          onSave={(lentTo) => onSave(row, { lentTo })}
        />
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

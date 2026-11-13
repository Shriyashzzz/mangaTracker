// What they own of a series, book by book, and what each cost them: "Deluxe 2
// (vols. 4–6)" as a scan or an import recorded it, and every volume ticked by
// hand as a row of its own. Each row takes what they paid and the day they
// bought it; a hand-ticked volume becomes a book the moment it's given one.
// Folded away, with what they've spent on the series beside its name.
//
// The rows are worked out in yourBooksRows.ts; one row is drawn by BookRow.
import { useEffect, useState } from "react";
import { centsOf, spentOn, type OwnedBook } from "../../lib/books";
import {
  addBooks,
  getBooks,
  removeBook,
  savePurchase,
} from "../../lib/booksApi";
import { formatCents } from "../../lib/prices";
import BookRow, { type Purchase } from "./BookRow";
import { detailsStyles as styles } from "./styles";
import { looseBook, rowsOf, type BookRow as Row } from "./yourBooksRows";

type Props = {
  mangaId: number;
  // the volumes they own, in order
  owned: number[];
  // a book removed took its volumes with it
  onRemoved: (owned: {
    volumesOwned: number | null;
    ownedList: number[];
  }) => void;
};

// how many rows show at first, and how many each press adds
const STEP = 5;
// the most books the server takes in one request
const MOST_AT_ONCE = 50;
const DEFAULT_NOTE =
  "What you paid is only yours to see. Removing a book takes its volumes off your shelf too.";

export default function YourBooks({ mangaId, owned, onRemoved }: Props) {
  const [books, setBooks] = useState<OwnedBook[]>([]);
  // a failure, said under the list
  const [note, setNote] = useState("");
  // the "paid the same" box
  const [samePrice, setSamePrice] = useState("");
  const [settingSame, setSettingSame] = useState(false);
  const [shown, setShown] = useState(STEP);

  // the books are asked for again whenever the owned volumes change
  const ownedKey = owned.join();
  useEffect(() => {
    const controller = new AbortController();
    getBooks(mangaId, controller.signal)
      .then(setBooks)
      .catch(() => {});
    return () => controller.abort();
  }, [mangaId, ownedKey]);

  if (!owned.length) return null;

  const rows = rowsOf(books, owned);
  const spent = spentOn(books);
  const unpriced = rows.filter((row) => row.book?.paidCents == null);
  const failed = () => setNote("That didn't save. Try again.");

  // what they paid or the day they bought it, on a book or a loose volume
  const save = async (row: Row, change: Purchase) => {
    setNote("");
    try {
      if (row.book) {
        const bookId = row.book.id;
        await savePurchase(mangaId, bookId, change);
        setBooks((list) =>
          list.map((book) =>
            book.id === bookId ? { ...book, ...change } : book,
          ),
        );
        return;
      }
      // a hand-ticked volume has no book to keep it on: only a value makes one
      const hasValue = change.paidCents != null || Boolean(change.boughtOn);
      if (!hasValue) return;
      const made = { ...looseBook(row.volume!), ...change };
      setBooks(await addBooks(mangaId, [made]));
    } catch {
      failed();
    }
  };

  // one price for every row that has none: a run bought at the same price
  const setSamePriceOnAll = async () => {
    const cents = centsOf(samePrice);
    if (cents === null || !unpriced.length) return;
    setSettingSame(true);
    setNote("");
    try {
      for (const row of unpriced) {
        if (row.book)
          await savePurchase(mangaId, row.book.id, { paidCents: cents });
      }
      const newBooks = unpriced
        .filter((row) => !row.book)
        .map((row) => ({ ...looseBook(row.volume!), paidCents: cents }));
      for (let start = 0; start < newBooks.length; start += MOST_AT_ONCE)
        await addBooks(mangaId, newBooks.slice(start, start + MOST_AT_ONCE));
      setBooks(await getBooks(mangaId));
      setSamePrice("");
    } catch {
      failed();
    } finally {
      setSettingSame(false);
    }
  };

  const remove = async (row: Row) => {
    const book = row.book;
    if (!book) return;
    setNote("");
    try {
      onRemoved(await removeBook(mangaId, book.id));
      setBooks((list) => list.filter((b) => b.id !== book.id));
    } catch {
      failed();
    }
  };

  const hidden = rows.length - shown;
  return (
    <details className={styles.books}>
      <summary className={styles.booksSummary}>
        Your books <span className={styles.booksCount}>{rows.length}</span>
        {spent.books > 0 && (
          <span className={styles.booksSpent}>
            {formatCents(spent.cents)} paid
            {spent.books < rows.length && ` for ${spent.books}`}
          </span>
        )}
      </summary>
      <ul className={styles.booksList}>
        {rows.slice(0, shown).map((row) => (
          <BookRow key={row.key} row={row} onSave={save} onRemove={remove} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          className={styles.booksMore}
          onClick={() => setShown(shown + STEP)}
        >
          Show {Math.min(STEP, hidden)} more
          <span className={styles.booksMoreLeft}>
            {shown} of {rows.length}
          </span>
        </button>
      )}
      {unpriced.length > 1 && (
        <form
          className={styles.booksSame}
          onSubmit={(e) => {
            e.preventDefault();
            void setSamePriceOnAll();
          }}
        >
          <label htmlFor="books-same">
            Paid the same for the {unpriced.length} without a price?
          </label>
          <span className={styles.bookPaid}>
            <span aria-hidden>$</span>
            <input
              id="books-same"
              className={styles.bookPaidInput}
              inputMode="decimal"
              placeholder="each"
              value={samePrice}
              onChange={(e) => setSamePrice(e.target.value)}
            />
          </span>
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={settingSame || centsOf(samePrice) === null}
          >
            Set them
          </button>
        </form>
      )}
      <p className={styles.booksNote} role="status">
        {note || DEFAULT_NOTE}
      </p>
    </details>
  );
}

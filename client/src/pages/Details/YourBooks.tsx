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
  ownEditionBook,
  removeBook,
  savePurchase,
} from "../../lib/booksApi";
import { formatPaid } from "../../lib/prices";
import { setVolumesOwned } from "../../lib/shelf";
import { ownedVolumes, toggleVolume } from "../../lib/ownedVolumes";
import BookRow, { type Purchase } from "./BookRow";
import { detailsStyles as styles } from "./styles";
import { looseBook, rowsOf, type BookRow as Row } from "./yourBooksRows";
import {
  editionBookLabel,
  insideText,
  type EditionBook,
  type EditionLine,
} from "../../lib/editions";
import { SortMenu } from "../Home/ShelfBar";

// the last book of a line the catalog lists: past it, books are only
// worked out from the series' volumes and may not be out
const lastListedIndex = (line: EditionLine) =>
  line.books.reduce((last, book, i) => (book.listed ? i : last), -1);

// an edition book they've recorded already: the same ISBN, or without one
// the same kind of edition holding the same volumes (Deluxe 3 and a Perfect
// Edition 3 hold different volumes, so they're never mixed up)
const isSameBook = (had: OwnedBook, line: EditionLine, book: EditionBook) =>
  had.isbn13 && book.isbn13
    ? had.isbn13 === book.isbn13
    : had.edition === line.kind && had.volumes.join() === book.volumes.join();

type Props = {
  mangaId: number;
  // the volumes they own, in order
  owned: number[];
  // a book removed took its volumes with it
  onRemoved: (owned: {
    volumesOwned: number | null;
    ownedList: number[];
  }) => void;
  // the series' omnibus and deluxe lines: their books can be added here
  lines: EditionLine[];
  // a book added put its volumes on the shelf
  onAdded: (owned: {
    volumesOwned: number | null;
    ownedList: number[];
  }) => void;
  // goes up when a book was added somewhere else (Buy next): asked again
  booksChanged: number;
};

// how many rows show at first, and how many each press adds
const STEP = 5;
// the most books the server takes in one request
const MOST_AT_ONCE = 50;
const PRIVATE_NOTE = "What you paid is only yours to see.";
const REMOVE_NOTE = " Removing a book takes its volumes off your shelf too.";

export default function YourBooks({
  mangaId,
  owned,
  onRemoved,
  lines,
  onAdded,
  booksChanged,
}: Props) {
  const [books, setBooks] = useState<OwnedBook[]>([]);
  // the series whose books have come: until then "Add a book you own"
  // waits, or it would offer books already recorded
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  // a failure, said under the list
  const [note, setNote] = useState("");
  // the "paid the same" box
  const [samePrice, setSamePrice] = useState("");
  const [settingSame, setSettingSame] = useState(false);
  const [shown, setShown] = useState(STEP);
  // the edition book picked to add, by its key; null: the first there is
  const [adding, setAdding] = useState<string | null>(null);
  const [addingNow, setAddingNow] = useState(false);

  // the books are asked for again whenever the owned volumes change
  const ownedKey = owned.join();
  useEffect(() => {
    const controller = new AbortController();
    getBooks(mangaId, controller.signal)
      .then((list) => {
        setBooks(list);
        setLoadedFor(mangaId);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [mangaId, ownedKey, booksChanged]);

  // the edition books not recorded yet, to pick one they own: "Deluxe 7
  // (vols. 19–21)"
  const toAdd = lines.flatMap((line) =>
    line.books
      // only books the catalog lists (the last ones of a line can be worked
      // out but not published yet), and not ones already recorded
      .filter((_, i) => i <= lastListedIndex(line))
      .filter((book) => !books.some((b) => isSameBook(b, line, book)))
      .map((book) => ({
        key: `${line.key}:${book.number}`,
        label: `${editionBookLabel(line, book)} (${insideText(book)})`,
        line,
        book,
      })),
  );
  const picked = toAdd.find((o) => o.key === adding) ?? toAdd[0];
  const addPicked = async () => {
    if (!picked) return;
    setNote("");
    setAddingNow(true);
    try {
      const added = await ownEditionBook(
        mangaId,
        owned,
        picked.line,
        picked.book,
      );
      // what they own now, whether or not the book itself saved
      onAdded(added.owned);
      if (!added.books) {
        failed();
        return;
      }
      // the books as the server has them now: the list shows the new one
      // even when its volumes were owned already
      setBooks(added.books);
      setAdding(null);
    } catch {
      failed();
    } finally {
      setAddingNow(false);
    }
  };

  if (!owned.length && !toAdd.length) return null;

  const rows = rowsOf(books, owned);
  // a recorded book can be removed here; a hand-ticked volume can't
  // every row: a book, or a volume ticked by hand
  const canRemove = rows.length > 0;
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

  // a recorded book goes with its volumes; a volume ticked by hand is
  // unticked, as tapping its spine again does
  const remove = async (row: Row) => {
    const book = row.book;
    setNote("");
    try {
      if (book) {
        onRemoved(await removeBook(mangaId, book.id));
        setBooks((list) => list.filter((b) => b.id !== book.id));
      } else if (row.volume != null) {
        const after = toggleVolume(ownedVolumes(null, owned), row.volume);
        onRemoved(await setVolumesOwned(mangaId, after));
      }
    } catch {
      failed();
    }
  };

  const hidden = rows.length - shown;
  return (
    <details className={styles.books} data-tour="your-books">
      <summary className={styles.booksSummary}>
        Your books <span className={styles.booksCount}>{rows.length}</span>
        {spent.books > 0 && (
          <span className={styles.booksSpent}>
            {formatPaid(spent.cents)} paid
            {spent.books < rows.length && ` for ${spent.books}`}
          </span>
        )}
      </summary>
      <ul className={styles.booksList}>
        {rows.slice(0, shown).map((row) => (
          <BookRow
            key={row.key}
            row={row}
            onSave={save}
            onRemove={remove}
            removeColumn={canRemove}
          />
        ))}
      </ul>
      {/* five more at a time, or the whole list at once (One Piece's 101
          books would be twenty clicks) */}
      {hidden > 0 && (
        <div className={styles.booksMore}>
          <span className={styles.booksMoreLinks}>
            <button
              type="button"
              className={styles.booksMoreLink}
              onClick={() => setShown(shown + STEP)}
            >
              Show {Math.min(STEP, hidden)} more
            </button>
            {hidden > STEP && (
              <button
                type="button"
                className={styles.booksMoreLink}
                onClick={() => setShown(rows.length)}
              >
                Show all {rows.length}
              </button>
            )}
          </span>
          <span className={styles.booksMoreLeft}>
            {shown} of {rows.length}
          </span>
        </div>
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
            Same price for the other {unpriced.length}?
          </label>
          <label className={styles.bookPaid}>
            <span aria-hidden>$</span>
            <input
              id="books-same"
              className={styles.bookPaidInput}
              inputMode="decimal"
              placeholder="price"
              value={samePrice}
              onChange={(e) => setSamePrice(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className={styles.booksAddButton}
            disabled={settingSame || centsOf(samePrice) === null}
          >
            Apply to {unpriced.length}
          </button>
        </form>
      )}
      {/* a deluxe or omnibus book they own, added by name: ticking spines
          only ever adds single volumes */}
      {loadedFor === mangaId && toAdd.length > 0 && picked && (
        <div className={styles.booksAdd}>
          <label htmlFor="books-add" className={styles.booksAddLabel}>
            Add a book you own
          </label>
          <div className={styles.booksAddPick}>
            <SortMenu
              id="books-add"
              box
              compact
              alignLeft
              menuLabel="Add a book you own"
              sortBy={picked.key}
              onSort={setAdding}
              options={toAdd.map((o) => ({ value: o.key, label: o.label }))}
            />
          </div>
          <button
            type="button"
            // as tall as the picker beside it, and the list's own boxes
            className={styles.booksAddButton}
            disabled={addingNow}
            onClick={() => void addPicked()}
          >
            {addingNow ? "Adding…" : "Add"}
          </button>
        </div>
      )}
      <p className={styles.booksNote} role="status">
        {note || `${PRIVATE_NOTE}${canRemove ? REMOVE_NOTE : ""}`}
      </p>
    </details>
  );
}

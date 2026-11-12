// What they own of a series, book by book, and what each cost them: "Deluxe 2
// (vols. 4–6)" as a scan or an import recorded it, and every volume ticked by
// hand as a row of its own. Each row takes what they paid and the day they
// bought it; a hand-ticked volume becomes a book the moment it's given one.
// Folded away, with what they've spent on the series beside its name.
import { useEffect, useState } from "react";
import {
  bookLabel,
  centsOf,
  dayOf,
  spentOn,
  type NewBook,
  type OwnedBook,
} from "../../lib/books";
import {
  addBooks,
  getBooks,
  removeBook,
  savePurchase,
} from "../../lib/booksApi";
import { formatCents } from "../../lib/prices";
import { detailsStyles as styles } from "./styles";

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

// a row: a recorded book, or a volume ticked by hand that has none yet
type Row = { key: string; book: OwnedBook | null; volume: number | null };

const looseBook = (volume: number): NewBook => ({
  isbn13: null,
  edition: "single",
  number: volume,
  title: null,
  volumes: [volume],
});
const moneyText = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2);

export default function YourBooks({ mangaId, owned, onRemoved }: Props) {
  const [books, setBooks] = useState<OwnedBook[]>([]);
  const [note, setNote] = useState("");
  // what's typed in a price box, until it's saved
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [same, setSame] = useState("");
  const [busy, setBusy] = useState(false);
  const ownedKey = owned.join();

  useEffect(() => {
    const controller = new AbortController();
    getBooks(mangaId, controller.signal)
      .then(setBooks)
      .catch(() => {});
    return () => controller.abort();
  }, [mangaId, ownedKey]);

  if (!owned.length) return null;

  const held = new Set(books.flatMap((b) => b.volumes));
  const rows: Row[] = [
    ...books.map((book) => ({ key: `b${book.id}`, book, volume: null })),
    ...owned
      .filter((v) => !held.has(v))
      .map((volume) => ({ key: `v${volume}`, book: null, volume })),
  ].sort(
    (a, b) =>
      (a.book ? Math.min(...a.book.volumes) : a.volume!) -
      (b.book ? Math.min(...b.book.volumes) : b.volume!),
  );
  const nameOf = (row: Row) =>
    row.book ? bookLabel(row.book) : `Vol. ${row.volume}`;
  const spent = spentOn(books);
  const unpriced = rows.filter((r) => r.book?.paidCents == null);

  const failed = () => setNote("That didn't save. Try again.");
  // what they paid or the day they bought it, on a book or a loose volume
  const save = async (
    row: Row,
    change: { paidCents?: number | null; boughtOn?: string | null },
  ) => {
    setNote("");
    try {
      if (row.book) {
        await savePurchase(mangaId, row.book.id, change);
        setBooks((list) =>
          list.map((b) => (b.id === row.book!.id ? { ...b, ...change } : b)),
        );
      } else {
        // nothing to keep on a volume with no book: only a value makes one
        if (change.paidCents == null && !change.boughtOn) return;
        setBooks(
          await addBooks(mangaId, [{ ...looseBook(row.volume!), ...change }]),
        );
      }
    } catch {
      failed();
    }
  };
  // the box as it was left: read from the box itself, so a quick tab away
  // never saves a letter behind
  const savePrice = (row: Row, text: string) => {
    setDrafts((d) => {
      const rest = { ...d };
      delete rest[row.key];
      return rest;
    });
    const cents = text.trim() ? centsOf(text) : null;
    // nonsense typed: the box goes back to what's saved
    if (text.trim() && cents === null) return;
    if (cents === (row.book?.paidCents ?? null)) return;
    void save(row, { paidCents: cents });
  };

  // one price for every row that has none: a run bought at the same price
  const applySame = async () => {
    const cents = centsOf(same);
    if (cents === null || !unpriced.length) return;
    setBusy(true);
    setNote("");
    try {
      for (const row of unpriced.filter((r) => r.book))
        await savePurchase(mangaId, row.book!.id, { paidCents: cents });
      const loose = unpriced
        .filter((r) => !r.book)
        .map((r) => ({ ...looseBook(r.volume!), paidCents: cents }));
      // 50 at a time, as the server takes them
      for (let i = 0; i < loose.length; i += 50)
        await addBooks(mangaId, loose.slice(i, i + 50));
      setBooks(await getBooks(mangaId));
      setSame("");
    } catch {
      failed();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (book: OwnedBook) => {
    setNote("");
    try {
      onRemoved(await removeBook(mangaId, book.id));
      setBooks((list) => list.filter((b) => b.id !== book.id));
    } catch {
      failed();
    }
  };

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
        {rows.map((row) => {
          const name = nameOf(row);
          return (
            <li key={row.key} className={styles.bookRow}>
              <span className={styles.bookName}>
                {name}
                {row.book?.isbn13 && (
                  <span className={styles.bookIsbn}>
                    ISBN {row.book.isbn13}
                  </span>
                )}
              </span>
              <span className={styles.bookPaid}>
                <span aria-hidden>$</span>
                <input
                  className={styles.bookPaidInput}
                  inputMode="decimal"
                  placeholder="paid"
                  aria-label={`What you paid for ${name}`}
                  value={drafts[row.key] ?? moneyText(row.book?.paidCents)}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                  }
                  onBlur={(e) => savePrice(row, e.currentTarget.value)}
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
                onChange={(e) =>
                  save(row, { boughtOn: e.target.value || null })
                }
              />
              {row.book ? (
                <button
                  type="button"
                  className={styles.bookRemove}
                  aria-label={`Remove ${name} and its volumes`}
                  onClick={() => remove(row.book!)}
                >
                  Remove
                </button>
              ) : (
                <span className={styles.bookRemoveGap} aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      {unpriced.length > 1 && (
        <form
          className={styles.booksSame}
          onSubmit={(e) => {
            e.preventDefault();
            void applySame();
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
              value={same}
              onChange={(e) => setSame(e.target.value)}
            />
          </span>
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={busy || centsOf(same) === null}
          >
            Set them
          </button>
        </form>
      )}
      <p className={styles.booksNote} role="status">
        {note ||
          "What you paid is only yours to see. Removing a book takes its volumes off your shelf too."}
      </p>
    </details>
  );
}

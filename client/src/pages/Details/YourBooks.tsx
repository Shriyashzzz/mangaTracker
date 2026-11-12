// The books behind the volumes they own: "Deluxe 2 (vols. 4–6)" with its
// ISBN, as a barcode scan or an import recorded it. Folded away, and absent
// when there are none: a volume ticked by hand has no book.
import { useEffect, useState } from "react";
import { bookLabel, type OwnedBook } from "../../lib/books";
import { getBooks, removeBook } from "../../lib/booksApi";
import { detailsStyles as styles } from "./styles";

type Props = {
  mangaId: number;
  // their owned volumes as last saved: the list is read again when they change
  ownedKey: string;
  // a book removed took its volumes with it
  onRemoved: (owned: {
    volumesOwned: number | null;
    ownedList: number[];
  }) => void;
};

export default function YourBooks({ mangaId, ownedKey, onRemoved }: Props) {
  const [books, setBooks] = useState<OwnedBook[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getBooks(mangaId, controller.signal)
      .then(setBooks)
      .catch(() => {});
    return () => controller.abort();
  }, [mangaId, ownedKey]);

  if (!books.length) return null;

  const remove = async (book: OwnedBook) => {
    setFailed(false);
    try {
      onRemoved(await removeBook(mangaId, book.id));
      setBooks((list) => list.filter((b) => b.id !== book.id));
    } catch {
      setFailed(true);
    }
  };

  return (
    <details className={styles.books}>
      <summary className={styles.booksSummary}>
        Your books <span className={styles.booksCount}>{books.length}</span>
      </summary>
      <ul className={styles.booksList}>
        {books.map((book) => (
          <li key={book.id} className={styles.bookRow}>
            <span className={styles.bookName}>{bookLabel(book)}</span>
            <span className={styles.bookIsbn}>
              {book.isbn13 ? `ISBN ${book.isbn13}` : "no ISBN"}
            </span>
            <button
              type="button"
              className={styles.bookRemove}
              aria-label={`Remove ${bookLabel(book)} and its volumes`}
              onClick={() => remove(book)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.booksNote} role="status">
        {failed
          ? "That didn't save. Try again."
          : "Removing a book takes its volumes off your shelf too."}
      </p>
    </details>
  );
}

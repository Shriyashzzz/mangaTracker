// Beside a series' title when no box set is priced for it: its deluxe (or
// omnibus) edition, the other way to own the run in fewer, bigger books. The
// next book for someone who has some of the series, the first for anyone
// else, and a way down to the whole list ("Other editions").
//
// Only books that can be opened: one the catalog has no ISBN for has no
// price and no page, so it isn't offered. When the book to lead with is one
// of those, there's no box at all (the list below still names every book).
import { NavLink, useSearchParams } from "react-router";
import {
  editionBookLabel,
  insideText,
  type EditionLine,
  editionTitle,
  leadBooksOf,
} from "../../lib/editions";
import { formatCents, volumePath } from "../../lib/prices";
import { pricesStyles as styles } from "./styles";

// a book's price: the one we know, or a nudge to check it
const priceText = (book: { knownPriceCents?: number | null }) =>
  book.knownPriceCents != null
    ? formatCents(book.knownPriceCents)
    : "check price";

export default function EditionsBox({
  line,
  owned,
  bare = false,
}: {
  line: EditionLine;
  // the volumes they own, when the series is on their shelf
  owned: number[];
  // just the books, with no box or title of its own: for the box that
  // holds box sets and editions together (SetsBox.tsx)
  bare?: boolean;
}) {
  const [, setParams] = useSearchParams();
  const leading = leadBooksOf(line, owned);
  if (!leading) return null;
  const { theirs, shown } = leading;
  const books = (
    <>
      <ul className={styles.editionsBoxList}>
        {shown.map((book, at) => {
          const label = editionBookLabel(line, book);
          const first = at === 0;
          const body = (
            <>
              <span className={first ? styles.setKindFirst : styles.setKind}>
                {first ? (theirs ? "Next for you" : "Starts with") : "Then"}
              </span>
              <span className={styles.setStore}>{label}</span>
              <span className={styles.setPrice}>{priceText(book)}</span>
              {/* the volumes inside, under the book's name */}
              <span className={styles.editionsBoxInside}>
                {insideText(book)}
              </span>
            </>
          );
          const ticket = first
            ? styles.editionsBoxTicket
            : styles.editionsBoxTicketPlain;
          return (
            <li key={book.number} className="min-w-0 upto-980:flex-1">
              <NavLink
                className={ticket}
                to={volumePath(book.isbn13!, book.title ?? label)}
                viewTransition
              >
                {body}
              </NavLink>
            </li>
          );
        })}
      </ul>
      {/* the way down to every book of it: a line of its own, so it's seen.
          Other editions below opens on this same edition (?edition=) */}
      <a
        href="#editions-title"
        className={styles.editionsBoxAll}
        onClick={(e) => {
          e.preventDefault();
          setParams(
            (now) => {
              const next = new URLSearchParams(now);
              next.set("edition", line.key);
              return next;
            },
            { replace: true, preventScrollReset: true },
          );
          document
            .getElementById("editions-title")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        See all {line.books.length} books <span aria-hidden>↓</span>
      </a>
    </>
  );
  if (bare) return books;
  return (
    <aside aria-labelledby="editions-box-title" className={styles.setsBox}>
      <h2 id="editions-box-title" className={styles.setsTitle}>
        {editionTitle(line)}
      </h2>
      {books}
    </aside>
  );
}

// Beside a series' title when no box set is priced for it: its deluxe (or
// omnibus) edition, the other way to own the run in fewer, bigger books. The
// next book for someone who has some of the series, the first for anyone
// else, and a way down to the whole list ("Other editions").
//
// Only books that can be opened: one the catalog has no ISBN for has no
// price and no page, so it isn't offered. When the book to lead with is one
// of those, there's no box at all (the list below still names every book).
import { NavLink } from "react-router";
import {
  editionBookLabel,
  editionPlan,
  insideText,
  type EditionLine,
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
}: {
  line: EditionLine;
  // the volumes they own, when the series is on their shelf
  owned: number[];
}) {
  const plan = editionPlan(line, owned);
  const theirs = owned.length > 0 && plan.next;
  // two books: theirs next (or the first), and the one after it
  const from = line.books.indexOf(
    line.books.find(
      (b) => b.number === (theirs ? plan.next! : line.books[0]!).number,
    )!,
  );
  const lead = line.books[from];
  if (!lead?.isbn13) return null;
  // the one after it too, when that can be opened
  const after = line.books[from + 1];
  const shown = after?.isbn13 ? [lead, after] : [lead];
  const inside = line.books.flatMap((b) => b.volumes);
  return (
    <aside aria-labelledby="editions-box-title" className={styles.setsBox}>
      <h2 id="editions-box-title" className={styles.setsTitle}>
        {/edition/i.test(line.label) ? line.label : `${line.label} edition`}
      </h2>
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
      <p className={styles.editionsBoxNote}>
        {line.books.length} books hold vols. {Math.min(...inside)}–
        {Math.max(...inside)}.{" "}
        <a href="#editions-title" className={styles.editionsBoxAll}>
          See all
        </a>
      </p>
    </aside>
  );
}

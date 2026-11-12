// Beside a series' title when no box set is priced for it: its deluxe (or
// omnibus) edition, the other way to own the run in fewer, bigger books. The
// next book for someone who has some of the series, the first for anyone
// else, and a way down to the whole list ("Other editions").
import { NavLink } from "react-router";
import {
  editionBookLabel,
  editionPlan,
  insideText,
  type EditionLine,
} from "../../lib/editions";
import { formatCents, volumePath } from "../../lib/prices";
import { pricesStyles as styles } from "./styles";

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
  const book = theirs ? plan.next! : line.books[0]!;
  const label = editionBookLabel(line, book);
  const inside = line.books.flatMap((b) => b.volumes);
  const body = (
    <>
      <span className={styles.setKindFirst}>
        {theirs ? "Next for you" : "Starts with"}
      </span>
      <span className={styles.setStore}>
        {label}
        <span className={styles.setAside}> · {insideText(book)}</span>
      </span>
      <span className={styles.setPrice}>
        {book.knownPriceCents != null
          ? formatCents(book.knownPriceCents)
          : book.isbn13
            ? "check price"
            : ""}
      </span>
    </>
  );
  return (
    <aside aria-labelledby="editions-box-title" className={styles.setsBox}>
      <h2 id="editions-box-title" className={styles.setsTitle}>
        {/edition/i.test(line.label) ? line.label : `${line.label} edition`}
      </h2>
      <ul className={styles.setsList}>
        <li className="upto-980:w-full">
          {book.isbn13 ? (
            <NavLink
              className={styles.editionsBoxTicket}
              to={volumePath(book.isbn13, book.title ?? label)}
              viewTransition
            >
              {body}
            </NavLink>
          ) : (
            <span className={styles.editionsBoxTicket}>{body}</span>
          )}
        </li>
      </ul>
      <p className={styles.editionsBoxNote}>
        {line.books.length} books hold vols. {Math.min(...inside)}–
        {Math.max(...inside)}.{" "}
        <a href="#editions-title" className={styles.editionsBoxAll}>
          See them all
        </a>
      </p>
    </aside>
  );
}

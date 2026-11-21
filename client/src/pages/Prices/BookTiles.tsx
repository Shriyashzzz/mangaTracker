// A line's books as tiles, each with its number big and the volumes it holds
// under it: "8 · 22–24". The one the lookup answered with is framed, and a
// book whose volumes they own every one of is inked in, as on the shelf
import clsx from "clsx";
import { rangesText } from "../../lib/ownedVolumes";
import { shownBooks, type LookupLine } from "../../lib/editionLookup";
import { editionsStyles as styles } from "./editionsStyles";

export default function BookTiles({
  line,
  volume = null,
  owned = [],
}: {
  line: LookupLine;
  // the volume asked about: its book is framed
  volume?: number | null;
  owned?: number[];
}) {
  const mine = new Set(owned);
  // out, or confirmed and coming (dashed); none nobody lists yet
  const books = shownBooks(line);
  const anyOwned = books.some((b) => b.volumes.every((v) => mine.has(v)));
  const anyComing = books.some((b) => b.coming);
  return (
    <>
      <ol className={styles.tiles} aria-label={`${line.label} books`}>
        {books.map((book) => {
          const ownsAll = book.volumes.every((v) => mine.has(v));
          return (
            <li
              key={book.number}
              className={clsx(
                styles.tile,
                ownsAll && styles.tileOwned,
                book.coming && styles.tileComing,
                volume != null &&
                  book.volumes.includes(volume) &&
                  styles.tileAnswer,
              )}
              aria-label={`${line.label} ${book.number}: ${book.volumes.length === 1 ? "vol." : "vols."} ${rangesText(book.volumes)}${ownsAll ? ", on your shelf" : ""}${book.coming ? `, out ${book.coming}` : ""}`}
            >
              <span className={styles.tileNumber} aria-hidden>
                {book.number}
              </span>
              <small className={styles.tileInside} aria-hidden>
                {rangesText(book.volumes)}
              </small>
              {book.coming && (
                <small className={styles.tileDate} aria-hidden>
                  {book.coming.replace(/ \d+,/, "")}
                </small>
              )}
            </li>
          );
        })}
      </ol>
      {(anyOwned || anyComing) && (
        <p className={styles.tilesKey}>
          {[
            anyOwned && "Inked in: on your shelf",
            anyComing && "Dashed: coming",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </>
  );
}

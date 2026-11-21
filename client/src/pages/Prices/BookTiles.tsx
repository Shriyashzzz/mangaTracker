// A line's books as tiles, each with its number big and the volumes it holds
// under it: "8 · 22–24". The one the lookup answered with is framed, and a
// book whose volumes they own every one of is inked in, as on the shelf
import clsx from "clsx";
import { rangesText } from "../../lib/ownedVolumes";
import type { LookupLine } from "../../lib/editionLookup";
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
  const anyOwned = line.books.some((b) => b.volumes.every((v) => mine.has(v)));
  return (
    <>
      <ol className={styles.tiles} aria-label={`${line.label} books`}>
        {line.books.map((book) => {
          const ownsAll = book.volumes.every((v) => mine.has(v));
          return (
            <li
              key={book.number}
              className={clsx(
                styles.tile,
                ownsAll && styles.tileOwned,
                volume != null &&
                  book.volumes.includes(volume) &&
                  styles.tileAnswer,
              )}
              aria-label={`${line.label} ${book.number}: ${book.volumes.length === 1 ? "vol." : "vols."} ${rangesText(book.volumes)}${ownsAll ? ", on your shelf" : ""}`}
            >
              <span className={styles.tileNumber} aria-hidden>
                {book.number}
              </span>
              <small className={styles.tileInside} aria-hidden>
                {rangesText(book.volumes)}
              </small>
            </li>
          );
        })}
      </ol>
      {anyOwned && <p className={styles.tilesKey}>Inked in: on your shelf</p>}
    </>
  );
}

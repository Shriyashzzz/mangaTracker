// One volume on the bookcase (VolumePicker.tsx): standing and inked when it's
// theirs. Pointers are handled by the shelf around it, which can tell a tap
// from a drag; the spine itself only answers Enter and Space.
// For someone collecting an edition the spine is one of its books instead
// (`book`): thicker, tapped rather than dragged, and part-inked when they
// own only some of its volumes.
import type { CSSProperties } from "react";
import { volumePickerStyles as styles } from "./styles";

type Book = {
  // what's lettered on it, and its name read out and on hover
  label: string;
  name: string;
  // how much of it is theirs when not all, 0 to 1
  share: number;
  // a single volume the edition has no book for: thinner
  single: boolean;
  onTap: () => void;
};

export default function Spine({
  volume,
  yours,
  onKeyboard,
  book,
}: {
  volume: number;
  yours: boolean;
  onKeyboard: (volume: number, yours: boolean) => void;
  book?: Book;
}) {
  if (book) {
    const part = !yours && book.share > 0;
    let spine: string = styles.bookDown;
    if (yours) spine = styles.bookUp;
    else if (part) spine = styles.bookPart;
    return (
      <button
        type="button"
        className={book.single ? styles.slot : styles.bookSlot}
        aria-pressed={yours}
        aria-label={book.name}
        title={book.name}
        onClick={book.onTap}
      >
        <span
          className={book.single ? `${spine} ${styles.bookSingle}` : spine}
          // never inked so far down that its number sits on ink
          style={
            part
              ? ({ "--part": `${20 + book.share * 35}%` } as CSSProperties)
              : undefined
          }
        >
          <span className={styles.number}>{book.label}</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      data-vol={volume}
      className={styles.slot}
      aria-pressed={yours}
      aria-label={`Vol. ${volume}`}
      // pointers are the shelf's; this is Enter and Space
      onClick={(e) => {
        if (e.detail === 0) onKeyboard(volume, yours);
      }}
    >
      <span className={yours ? styles.spineUp : styles.spineDown}>
        <span className={volume >= 100 ? styles.numberSmall : styles.number}>
          {volume}
        </span>
      </span>
    </button>
  );
}

// The little shelf beside the title: a book for every volume, ticked when
// they own it, with a line under it saying how many. A slide across several
// books at once can be undone for a few seconds (a swipe meant to scroll, on
// a phone, would otherwise tick a row of them).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import VolumeShelf from "../../components/volumeShelf/VolumeShelf";
import { rangesText } from "../../lib/ownedVolumes";
import { readLocal, writeLocal } from "../../lib/prefs";
import { BOOK } from "../../lib/volumeShelf";
import { detailsStyles as styles } from "./styles";
import type { useOwnedVolumes } from "./useOwnedVolumes";

// the shelf's least width beside the title, so its caption reads in a line or two
const SHELF_MIN = 208;
const SHELF_MAX = 460;
// remembered in the browser once they've ticked a book
const SHELF_HINT_KEY = "shelfHint";
// how long Undo stays
const UNDO_MS = 12_000;
// paints this close together are one slide
const SLIDE_GAP_MS = 1200;

type Props = {
  mangaId: number;
  name: string;
  // the volumes they own
  owned: number[];
  // how many books the shelf draws
  total: number;
  // false while that's a guess (the real number is on its way, or we don't
  // know the series): the caption then doesn't say "of 10"
  totalKnown: boolean;
  // ticks a volume, or sets the whole list, and saves it
  ownedVolumes: ReturnType<typeof useOwnedVolumes>;
};

export default function ShelfBox({
  mangaId,
  name,
  owned,
  total,
  totalKnown,
  ownedVolumes,
}: Props) {
  // "Tap a book to mark it yours": said until they've done it once on this
  // device. Nothing else on the page says the books can be pressed
  const [knowsTheShelf, setKnowsTheShelf] = useState(
    () => readLocal(SHELF_HINT_KEY) === "done",
  );
  const usedTheShelf = () => {
    if (knowsTheShelf) return;
    writeLocal(SHELF_HINT_KEY, "done");
    setKnowsTheShelf(true);
  };
  // what they owned before the slide going on now
  const slideStart = useRef<number[] | null>(null);
  const slideEndTimer = useRef(0);
  // what Undo would put back; null when there's nothing to undo
  const [undoTo, setUndoTo] = useState<number[] | null>(null);
  useEffect(() => {
    if (!undoTo) return;
    const gone = window.setTimeout(() => setUndoTo(null), UNDO_MS);
    return () => clearTimeout(gone);
  }, [undoTo]);

  // one slide is many paints close together: what they owned before the
  // first is what Undo gives back
  const paint = (next: number[]) => {
    usedTheShelf();
    slideStart.current ??= owned;
    const before = slideStart.current;
    // the slide lasts until the paints stop coming for a moment
    clearTimeout(slideEndTimer.current);
    slideEndTimer.current = window.setTimeout(() => {
      slideStart.current = null;
    }, SLIDE_GAP_MS);

    ownedVolumes.paint(next);
    const added = next.filter((v) => !before.includes(v)).length;
    const removed = before.filter((v) => !next.includes(v)).length;
    setUndoTo(added + removed > 1 ? before : null);
  };

  // halves and specials (10.5, vol. 0) aren't books on the shelf: said instead
  const offShelf = owned.filter((v) => !Number.isInteger(v) || v < 1);
  const onShelf = owned.length - offShelf.length;
  // the room a short series' books need, but never so little that the
  // caption under them breaks a word to a line
  const width = Math.min(SHELF_MAX, Math.max(total * BOOK, SHELF_MIN));

  return (
    <div
      className={styles.shelf}
      style={{ "--shelf-w": `${width}px` } as CSSProperties}
    >
      {/* the books keep to their own width; the caption gets the room */}
      <div style={{ maxWidth: total * BOOK }} data-tour="spines">
        <VolumeShelf
          key={mangaId}
          total={total}
          owned={owned}
          onToggle={(volume) => {
            usedTheShelf();
            setUndoTo(null);
            ownedVolumes.toggle(volume);
          }}
          onPaint={paint}
          name={name}
        />
      </div>
      {/* what the shelf says, in words: how many of how many, and any halves
          or specials it has no book for */}
      <p className={styles.shelfCaption}>
        <span>
          You own {onShelf}
          {totalKnown
            ? ` of ${total} volumes`
            : ` volume${onShelf === 1 ? "" : "s"}`}
          {offShelf.length > 0 &&
            `, plus vol${offShelf.length > 1 ? "s" : ""}. ${rangesText(offShelf)}`}
        </span>
        {!knowsTheShelf && (
          <span className={styles.shelfHint}>Tap a book to mark it yours.</span>
        )}
        {undoTo && (
          <button
            type="button"
            className={styles.chaptersToo}
            onClick={() => {
              ownedVolumes.paint(undoTo);
              setUndoTo(null);
            }}
          >
            Undo that slide
          </button>
        )}
      </p>
    </div>
  );
}

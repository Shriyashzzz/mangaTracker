// The little shelf beside the title: a book for every volume, ticked when
// they own it, with a line under it saying how many. A slide across several
// books at once can be undone for a few seconds (a swipe meant to scroll, on
// a phone, would otherwise tick a row of them).
// For someone collecting an edition (`edition`), the books are that
// edition's: 12 VIZBIGs, not 37 volumes. What they own is still saved as
// volumes; lib/editionShelf.ts turns one into the other, both ways.
import { useCallback, useRef, useState, type CSSProperties } from "react";
import Toast from "../../components/toast/Toast";
import { toastAction } from "../../components/toast/toastStyles";
import { shortEditionName } from "../../lib/editionShort";
import VolumeShelf from "../../components/volumeShelf/VolumeShelf";
import {
  isSingleSlot,
  ownedCaption,
  ownsEveryBook,
  placeInSlots,
  shareOwned,
  slotName,
  slotOfVolume,
  slotsIn,
  spineOf,
  stateOf,
  toggleSlot,
  volumesAfterPaint,
  type EditionShelf,
  runLabelOf,
} from "../../lib/editionShelf";
import { rangesText } from "../../lib/ownedVolumes";
import { readLocal, writeLocal } from "../../lib/prefs";
import { BOOK, pageScale } from "../../lib/volumeShelf";
import { detailsStyles as styles } from "./styles";
import type { useOwnedVolumes } from "./useOwnedVolumes";

// the shelf's least width beside the title, so its caption reads in a line or two
const SHELF_MIN = 208;
// and its most: 28 volumes keep books 20px wide, room for a readable number
const SHELF_MAX = 560;
// an edition's book on the shelf: thicker than a single volume's 22px
const EDITION_BOOK = 30;
// remembered in the browser once they've ticked a book
const SHELF_HINT_KEY = "shelfHint";
// paints this close together are one slide
const SLIDE_GAP_MS = 1200;

// what a slide across the books did, for its Undo note: "6 volumes marked
// yours", "3 volumes taken off your shelf"
function slideText(before: number[], now: number[]) {
  const added = now.filter((v) => !before.includes(v)).length;
  const removed = before.filter((v) => !now.includes(v)).length;
  const volumes = (n: number) => `${n} ${n === 1 ? "volume" : "volumes"}`;
  if (added && !removed) return `${volumes(added)} marked yours`;
  if (removed && !added) return `${volumes(removed)} taken off your shelf`;
  return `${volumes(added + removed)} changed`;
}

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
  // where they are, marked on the shelf and said in the caption: the volume
  // their chapter is in ("reading"), or the one they've read up to
  place?: { volume: number; kind: "reading" | "read up to" } | null;
  // the edition they collect, and its books on this shelf; null for single
  // volumes
  edition?: EditionShelf | null;
  // the books they've recorded: a spine is named by the edition its book
  // really is
  recorded?: { label?: string | null; volumes: number[] }[];
  // single volumes ordered and on their way: drawn as such
  ordered?: number[];
  // the app's "Your shelf" heading; the Volumes tab's rows have their own
  heading?: boolean;
  // a phone's page of books opens near this volume (the Volumes tab: their
  // first gap, or where its bar was tapped)
  opensAt?: number | null;
};

export default function ShelfBox({
  mangaId,
  name,
  owned,
  total,
  totalKnown,
  ownedVolumes,
  place = null,
  edition = null,
  recorded = [],
  ordered = [],
  heading = true,
  opensAt = null,
}: Props) {
  // the part-owned book they tapped: asked about before it's completed
  // (with the edition it's a book of: the question goes if they switch)
  const [asked, setAsked] = useState<{ line: string; slot: number } | null>(
    null,
  );
  const asking = asked && asked.line === edition?.line.key ? asked.slot : null;
  const setAsking = (slot: number | null) =>
    setAsked(slot && edition ? { line: edition.line.key, slot } : null);
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
  // what Undo would put back; null when there's nothing to undo. Offered in
  // the app's own note at the foot of the screen (Toast), which goes by itself
  const [undoTo, setUndoTo] = useState<number[] | null>(null);
  const dropUndo = useCallback(() => setUndoTo(null), []);

  // one slide is many paints close together: what they owned before the
  // first is what Undo gives back
  const paint = (
    next: number[],
    // whether this was a slide across several, which Undo is for. An
    // edition's shelf says (one tap there is several volumes)
    wasSlide?: boolean,
  ) => {
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
    setUndoTo((wasSlide ?? added + removed > 1) ? before : null);
  };

  // halves and specials (10.5, vol. 0) aren't books on the shelf: said instead
  const offShelf = owned.filter((v) => !Number.isInteger(v) || v < 1);
  const onShelf = owned.length - offShelf.length;

  // ---------- seen through an edition ----------
  const slots = edition?.slots ?? [];
  const tapSlot = (number: number) => {
    const slot = slots[number - 1];
    if (!slot) return;
    usedTheShelf();
    setUndoTo(null);
    // one volume of a book they tapped: completing it is asked, not assumed
    if (stateOf(slot, owned) === "part") return setAsking(number);
    setAsking(null);
    ownedVolumes.paint(toggleSlot(slot, owned));
  };
  // A slide (and a mouse's click, which the shelf treats as a short slide)
  // left exactly these slots standing. One that only stood up a book they
  // own part of is the same question as a tap on it
  const paintSlots = (standing: number[]) => {
    const before = slotsIn(slots, owned, "all");
    const stoodUp = standing.filter((n) => !before.includes(n));
    const laidDown = before.filter((n) => !standing.includes(n));
    const only = stoodUp.length === 1 && !laidDown.length ? stoodUp[0]! : null;
    if (only && stateOf(slots[only - 1]!, owned) === "part") {
      usedTheShelf();
      return setAsking(only);
    }
    setAsking(null);
    // one book stood up or laid down is a tap, not a slide to undo
    const wasSlide = stoodUp.length + laidDown.length > 1;
    paint(
      volumesAfterPaint(slots, owned, standing),
      wasSlide || slideStart.current != null,
    );
  };
  const askedSlot = asking ? slots[asking - 1] : null;
  const placeInEdition = edition ? placeInSlots(slots, place) : null;
  // the count goes once every book is theirs, unless it's all the line has
  const showCount = !ownsEveryBook(slots, owned) || !placeInEdition;
  // "You own 2 of 7": in the app it stands beside the section's heading, and
  // the caption keeps the rest (where they are, any extras)
  const singlesCount = `You own ${onShelf}${
    totalKnown ? ` of ${total} volumes` : ` volume${onShelf === 1 ? "" : "s"}`
  }`;
  const editionCount = edition && showCount ? ownedCaption(slots, owned) : null;
  const ownCount = edition ? editionCount : singlesCount;

  const books = edition ? slots.length : total;
  // a tablet's page is drawn bigger (index.css): its books and room too
  const scale = pageScale();
  const bookWidth = (edition ? EDITION_BOOK : BOOK) * scale;
  // the room a short series' books need, but never so little that the
  // caption under them breaks a word to a line
  const width = Math.min(
    SHELF_MAX * scale,
    Math.max(books * bookWidth, SHELF_MIN * scale),
  );

  return (
    <div
      className={styles.shelf}
      style={{ "--shelf-w": `${width}px` } as CSSProperties}
    >
      {/* the app's section heading (index.css .app-section-title) */}
      {heading && (
        <h2 className="app-only app-section-title app-shelf-head">
          <span>Your shelf</span>
          {ownCount && <span className="app-shelf-count">{ownCount}</span>}
        </h2>
      )}
      {/* the books keep to their own width, centred over the caption,
          which gets the room: the same space either side */}
      <div
        className="mx-auto"
        style={{ maxWidth: books * bookWidth }}
        data-tour="spines"
      >
        {edition ? (
          <VolumeShelf
            // a different shelf for each edition: the slide and the page it
            // was on belong to the one they were looking at
            key={`${mangaId}-${edition.line.key}`}
            total={slots.length}
            owned={slotsIn(slots, owned, "all")}
            // a book whose missing volumes are all ordered: on its way
            ordered={slots.flatMap((slot, i) => {
              const missing = slot.volumes.filter((v) => !owned.includes(v));
              return missing.length && missing.every((v) => ordered.includes(v))
                ? [i + 1]
                : [];
            })}
            onToggle={tapSlot}
            onPaint={paintSlots}
            name={name}
            here={placeInEdition?.slot ?? null}
            opensAt={opensAt == null ? null : slotOfVolume(slots, opensAt)}
            slots={{
              bookWidth: EDITION_BOOK,
              spine: (n) => spineOf(slots[n - 1]!),
              // a long edition name is cut short to fit over a spine
              runName: (n) => {
                const label = runLabelOf(slots[n - 1]!, edition.line, recorded);
                return label.length > 10 ? shortEditionName(label) : label;
              },
              name: (n) => slotName(edition.line, slots[n - 1]!, owned),
              share: (n) => shareOwned(slots, owned, n),
              isSingle: (n) => isSingleSlot(slots[n - 1]!),
            }}
          />
        ) : (
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
            here={place?.volume ?? null}
            ordered={ordered}
            opensAt={opensAt}
          />
        )}
      </div>
      {/* what the shelf says, in words: how many of how many, and any halves
          or specials it has no book for */}
      <p className={styles.shelfCaption}>
        {edition ? (
          <span>
            {/* "Read up to book 4 · You own 4 of 12". Once every book is
                theirs, only where they are: "Read up to book 12" */}
            {placeInEdition && (
              <span className={styles.shelfPlace}>{placeInEdition.text}</span>
            )}
            {/* said beside the heading in the app (ownCount) */}
            {showCount && (
              <span className={heading ? "app-web-only" : undefined}>
                {placeInEdition && (
                  // hidden with the place on a phone
                  <span className="upto-720:hidden"> · </span>
                )}
                {ownedCaption(slots, owned)}
              </span>
            )}
            {offShelf.length > 0 &&
              `, plus vol${offShelf.length > 1 ? "s" : ""}. ${rangesText(offShelf)}`}
          </span>
        ) : (
          <span>
            {/* where they are first, in the marker's red: "Read up to vol. 2" */}
            {place && (
              <span className={styles.shelfPlace}>
                {place.kind === "reading" ? "Reading" : "Read up to"} vol.{" "}
                {place.volume}
              </span>
            )}
            {/* said beside the heading in the app (ownCount) */}
            <span className={heading ? "app-web-only" : undefined}>
              {place && (
                // hidden with the place on a phone
                <span className="upto-720:hidden"> · </span>
              )}
              {ownCount}
            </span>
            {offShelf.length > 0 &&
              `, plus vol${offShelf.length > 1 ? "s" : ""}. ${rangesText(offShelf)}`}
          </span>
        )}
        {/* they tapped a book they own part of: what they have of it, and
            the question, before anything changes */}
        {edition && askedSlot && (
          <span
            className={styles.shelfAsk}
            role="group"
            aria-label="Own the whole book?"
          >
            <span>
              {slotName(edition.line, askedSlot, owned)}. Own the whole book?
            </span>
            <button
              type="button"
              className={styles.chaptersToo}
              onClick={() => {
                setAsking(null);
                ownedVolumes.paint(toggleSlot(askedSlot, owned));
              }}
            >
              Yes, all of it
            </button>
            <button
              type="button"
              className={styles.chaptersToo}
              onClick={() => setAsking(null)}
            >
              No
            </button>
          </span>
        )}
        {!knowsTheShelf && (
          <span className={styles.shelfHint}>Tap a book to mark it yours.</span>
        )}
      </p>
      {undoTo && (
        // one note a slide: a new slide starts it again
        <Toast key={undoTo.join()} onGone={dropUndo}>
          <span className="min-w-0">{slideText(undoTo, owned)}</span>
          <button
            type="button"
            className={toastAction}
            onClick={() => {
              ownedVolumes.paint(undoTo);
              setUndoTo(null);
            }}
          >
            Undo
          </button>
        </Toast>
      )}
    </div>
  );
}

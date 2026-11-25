// One series on a shared shelf, opened from its card: the volumes they own as
// spines on a shelf (a gap stands empty), how far they are, their rating and
// notes, a way to keep it on their own shelf (AddToShelf), a link to this
// series on this shelf, and the way to its prices. A native dialog brings the
// focus trap, Escape and the backdrop
import { hasBottomBar } from "../../lib/bottomBar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router";
import SeriesPicture from "../../components/cover/SeriesPicture";
import { CheckIcon, CloseIcon, LinkIcon } from "../../components/icons/Icons";
import StarRating from "../../components/starRating/StarRating";
import { priceName, seriesPath } from "../../lib/prices";
import AddToShelf from "./AddToShelf";
import Synopsis from "./Synopsis";
import TopPick from "./TopPick";
import {
  ownedVolumesOf,
  shelfOf,
  statusOf,
  toneOf,
  volumeRanges,
  type SharedManga,
} from "./shareParts";
import { shareStyles as styles } from "./styles";

function Spines({ owned, name }: { owned: number[]; name: string }) {
  return (
    <div
      className={styles.spines}
      role="img"
      aria-label={`${name}: owns volumes ${volumeRanges(owned)}`}
    >
      {shelfOf(owned).map(({ v, mine }) => (
        <span key={v} className={mine ? styles.spine : styles.gap}>
          {v}
        </span>
      ))}
    </div>
  );
}

// A series' cover in a frame of the page's own (`className`), with whatever
// is stamped over it (`children`). `sizes`: how wide it's drawn, for the
// picture to be fetched at that size (components/cover/Cover.tsx)
export function SeriesCover({
  m,
  className,
  sizes,
  children,
}: {
  m: SharedManga;
  className: string;
  sizes: string;
  children?: ReactNode;
}) {
  return (
    <div className={className}>
      <SeriesPicture
        name={m.name}
        lightNovel={m.lightNovel}
        url={m.image}
        sizes={sizes}
      />
      {children}
    </div>
  );
}

// the page's address already names the series (?series=): that's the link
function CopySeriesLink() {
  const [copied, setCopied] = useState(false);
  // on a phone, the phone's own share sheet, as Settings' Share link does
  const sharesBySheet = hasBottomBar() && "share" in navigator;
  const copy = async () => {
    if (sharesBySheet) {
      // closing the sheet without picking anything is fine
      await navigator.share({ url: window.location.href }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // no clipboard: the address bar has it
    }
  };
  return (
    <button
      type="button"
      className="btn btn-secondary gap-2 [&_svg]:size-4"
      onClick={copy}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
      <span aria-live="polite">
        {sharesBySheet ? "Share link" : copied ? "Copied" : "Copy link"}
      </span>
    </button>
  );
}

export default function SeriesSheet({
  m,
  owner,
  topPick,
  pick,
  onClose,
}: {
  m: SharedManga;
  owner: string;
  // for the owner on their own shelf: the series at the top now, and what
  // to do when they change it
  topPick?: { top: string[]; onChange: (top: string[]) => void };
  // for a visitor without an account who's comparing shelves: whether
  // they've marked this one as theirs too, and what marks it
  pick?: { picked: boolean; onToggle: () => void };
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  const owned = ownedVolumesOf(m);
  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      className={`${styles.sheet} app-sheet-dialog`}
      style={toneOf(m)}
      aria-labelledby="series-sheet-title"
      onClose={onClose}
      // the backdrop counts as the dialog itself; its contents are all children
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className={styles.sheetHead}>
        <h2 id="series-sheet-title" className={styles.sheetTitle}>
          {m.name}
        </h2>
        <button
          type="button"
          className={styles.sheetClose}
          aria-label="Close"
          onClick={close}
        >
          <CloseIcon />
        </button>
      </div>

      <div className={styles.sheetBody}>
        <div className={styles.sheetTop}>
          <SeriesCover m={m} className={styles.sheetCover} sizes="96px" />
          <dl className={styles.facts}>
            <dt>Status</dt>
            <dd>{statusOf(m)}</dd>
            {Boolean(m.bookmark) && !m.status && (
              <>
                <dt>Up to</dt>
                <dd>Chapter {m.bookmark}</dd>
              </>
            )}
            {Boolean(m.readVolume) && !m.status && (
              <>
                <dt>Read</dt>
                <dd>Up to vol. {m.readVolume}</dd>
              </>
            )}
            <dt>Owns</dt>
            <dd>
              {owned.length
                ? `${owned.length} volume${owned.length === 1 ? "" : "s"}`
                : "None yet"}
            </dd>
            {m.rating ? (
              <>
                {/* whose: not a score from the site */}
                <dt>Their rating</dt>
                <dd>
                  <StarRating value={m.rating} size="sm" />
                </dd>
              </>
            ) : null}
            {m.genre && m.genre !== "unlabled" && (
              <>
                <dt>Genre</dt>
                <dd>{m.genre}</dd>
              </>
            )}
          </dl>
        </div>
        <Synopsis m={m} />
        {topPick ? <TopPick m={m} {...topPick} /> : <AddToShelf m={m} />}
        {pick && (
          <p className={styles.addLine}>
            <button
              type="button"
              className={pick.picked ? "btn btn-primary" : "btn btn-secondary"}
              aria-pressed={pick.picked}
              onClick={pick.onToggle}
            >
              {pick.picked ? "Yours too" : "I have this"}
            </button>
          </p>
        )}

        {/* what they wrote about it, before the volumes: it's the part a
            visitor reads */}
        {m.notes && (
          <section aria-labelledby="series-sheet-notes">
            <h3 id="series-sheet-notes" className={styles.label}>
              Notes
            </h3>
            <p className={styles.notes}>{m.notes}</p>
          </section>
        )}

        <section aria-labelledby="series-sheet-volumes">
          <h3 id="series-sheet-volumes" className={styles.label}>
            On {owner}'s shelf
          </h3>
          {owned.length ? (
            <>
              <Spines owned={owned} name={m.name} />
              <p className={styles.ranges}>Vol. {volumeRanges(owned)}</p>
            </>
          ) : (
            <p className={styles.ranges}>
              No volumes of this one on the shelf yet.
            </p>
          )}
        </section>
      </div>

      <div className={styles.sheetFoot}>
        <NavLink
          to={seriesPath(priceName(m))}
          className="btn btn-secondary"
          viewTransition
        >
          See prices
        </NavLink>
        <CopySeriesLink />
      </div>
    </dialog>
  );
}

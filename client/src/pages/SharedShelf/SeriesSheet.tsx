// One series on a shared shelf, opened from its card: the volumes they own as
// spines on a shelf (a gap stands empty), how far they are, their rating and
// notes, a way to keep it on their own shelf (AddToShelf), a link to this
// series on this shelf, and the way to its prices. A native dialog brings the
// focus trap, Escape and the backdrop
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router";
import { CheckIcon, CloseIcon, LinkIcon } from "../../components/icons/Icons";
import DrawnCover from "../../components/drawnCover/DrawnCover";
import StarRating from "../../components/starRating/StarRating";
import { priceName, seriesPath } from "../../lib/prices";
import AddToShelf from "./AddToShelf";
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

export function Cover({
  m,
  className,
  children,
}: {
  m: SharedManga;
  className: string;
  children?: ReactNode;
}) {
  // no cover, or one that won't load: its name, lettered on
  const [broken, setBroken] = useState(false);
  return (
    <div className={className}>
      {m.image && !broken ? (
        <img
          src={m.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <DrawnCover title={m.name} />
      )}
      {children}
    </div>
  );
}

// the page's address already names the series (?series=): that's the link
function CopySeriesLink() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
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
      <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}

export default function SeriesSheet({
  m,
  owner,
  onClose,
}: {
  m: SharedManga;
  owner: string;
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
      className={styles.sheet}
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
          <Cover m={m} className={styles.sheetCover} />
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
                <dt>Rating</dt>
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
            {m.lightNovel && (
              <>
                <dt>Kind</dt>
                <dd>Light novel</dd>
              </>
            )}
          </dl>
        </div>
        <AddToShelf m={m} />

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

        {m.notes && (
          <section aria-labelledby="series-sheet-notes">
            <h3 id="series-sheet-notes" className={styles.label}>
              Notes
            </h3>
            <p className={styles.notes}>{m.notes}</p>
          </section>
        )}
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

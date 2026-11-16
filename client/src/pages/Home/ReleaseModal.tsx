// The volumes that are out for one series and aren't the reader's yet: what
// a New card opens when they're more than one behind. Each row leads to
// that book's prices. From the Chapters list, the English books holding
// their next chapter and on, each with its chapters, and word of the
// chapters out that no English volume holds yet. A native dialog: it brings its own focus trap, Escape
// and backdrop. On phones it's a sheet at the bottom, as tall as its list.
import { useEffect, useRef } from "react";
import { NavLink } from "react-router";
import KeepRanges from "../../components/keepRanges/KeepRanges";
import { chaptersText } from "../../lib/chapterWords";
import { volumePath } from "../../lib/prices";
import { volumesToGet } from "../../lib/releaseMath";
import type { Manga, ReleaseStatus } from "../../lib/types";
import { homeStyles as styles } from "./styles";

type Props = {
  manga: Manga;
  found: ReleaseStatus;
  // where they are: "You own up to vol. 8"
  yours?: string;
  // which list's card opened it: a volumes card, or a chapters one
  kind?: "volumes" | "chapters";
  onClose: () => void;
};

const count = (n: number) => n.toLocaleString("en-US");

// the chapters out past theirs, when the chapter list can't say which
// volume holds them: said so, never guessed
function cantTellYet(from: number, to: number) {
  return from === to
    ? `Ch. ${count(from)} is out. We can't tell yet if it's in an English volume.`
    : `Ch. ${count(from)}–${count(to)} are out. We can't tell yet if they're in an English volume.`;
}

// "Vol. 28 ends at ch. 210. Ch. 211–220 are out, but they aren't in an
// English volume yet."
function notInEnglishYet(
  past: NonNullable<ReleaseStatus["chaptersPastEnglish"]>,
) {
  const { volume, endsAt, from, to } = past;
  // (an answer saved before these were sent has neither)
  const ends =
    volume != null && endsAt != null
      ? `Vol. ${volume} ends at ch. ${count(endsAt)}.`
      : "";
  const out =
    from === to
      ? `Ch. ${count(from)} is out, but it isn't in an English volume yet.`
      : `Ch. ${count(from)}–${count(to)} are out, but they aren't in an English volume yet.`;
  return ends ? `${ends} ${out}` : out;
}

export default function ReleaseModal({
  manga,
  found,
  yours,
  kind = "volumes",
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const rows = useRef<HTMLUListElement>(null);
  // where this series' list was scrolled to when they left for a volume's
  // prices, so Back puts them at the same row (pricing 65 volumes meant
  // scrolling down again each time). Forgotten when the list is closed
  const spotKey = `releaseListSpot:${manga.id}`;

  useEffect(() => {
    // no closing on the way out: leaving the page takes it with it, and a close
    // here would come back as a close event and shut the next one
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    const spot = Number(sessionStorage.getItem(spotKey));
    if (rows.current && Number.isFinite(spot)) rows.current.scrollTop = spot;
  }, [spotKey]);
  const keepSpot = () =>
    sessionStorage.setItem(spotKey, String(rows.current?.scrollTop ?? 0));
  const close = () => {
    sessionStorage.removeItem(spotKey);
    onClose();
  };

  // every volume past theirs: the count the card gave. For a chapters card,
  // the books holding their next chapter and on
  const byChapter = kind === "chapters";
  const volumes = byChapter ? [] : volumesToGet(found);
  const books = byChapter ? (found.chapterBooks ?? []) : [];
  const pastEnglish = byChapter ? (found.chaptersPastEnglish ?? null) : null;
  const title = byChapter
    ? `${manga.name}: ch. ${count(found.nextChapter ?? 0)} next`
    : `${manga.name}: ${volumes.length} ${volumes.length === 1 ? "volume" : "volumes"} behind`;

  return (
    <dialog
      ref={dialog}
      className={styles.modal}
      aria-labelledby="release-title"
      onClose={close}
      // the backdrop counts as the dialog itself; its contents are all children
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <div className={styles.modalHead}>
        <h2 id="release-title" className={styles.modalTitle}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.modalClose}
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </div>

      <ul className={styles.modalRows} ref={rows}>
        {/* first in the list: above the rows on a laptop, and at the foot
            on a phone, where the rows stack up from it */}
        {yours && (
          <li className={styles.modalYours}>
            <KeepRanges text={yours} />
          </li>
        )}
        {books.map((b) => (
          <li key={b.isbn13 ?? b.volume} className={styles.modalRow}>
            {b.isbn13 ? (
              <NavLink
                to={volumePath(b.isbn13, b.title ?? "")}
                className={styles.modalRowLink}
                onClick={keepSpot}
                viewTransition
              >
                <span>
                  {b.label}
                  {b.chapters && (
                    <span className={styles.modalChapters}>
                      {" "}
                      · {chaptersText(b.chapters)}
                    </span>
                  )}
                </span>
                <span className={styles.modalRowGo}>See prices</span>
              </NavLink>
            ) : (
              <span className={styles.modalName}>
                {b.label}
                {b.chapters && (
                  <span className={styles.modalChapters}>
                    {" "}
                    · {chaptersText(b.chapters)}
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
        {volumes.map((v) => (
          <li key={v.volume} className={styles.modalRow}>
            {v.isbn13 ? (
              <NavLink
                to={volumePath(v.isbn13, v.title ?? "")}
                className={styles.modalRowLink}
                onClick={keepSpot}
                viewTransition
              >
                Vol. {v.volume}
                <span className={styles.modalRowGo}>See prices</span>
              </NavLink>
            ) : (
              // out, but we have no book on file for it to price
              <span className={styles.modalName}>Vol. {v.volume}</span>
            )}
          </li>
        ))}
        {/* chapters out that no English volume holds (or that we can't
            place): last in the list, so under the rows on a laptop and at
            the top of a phone's sheet, whose rows stack up from the foot */}
        {pastEnglish && (
          <li className={styles.modalNote}>{notInEnglishYet(pastEnglish)}</li>
        )}
        {byChapter &&
          !pastEnglish &&
          !books.length &&
          found.nextChapter != null && (
            <li className={styles.modalNote}>
              {cantTellYet(
                found.nextChapter,
                found.latestChapter ?? found.nextChapter,
              )}
            </li>
          )}
      </ul>

      <div className={styles.modalFoot}>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

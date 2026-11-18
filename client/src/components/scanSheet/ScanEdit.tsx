// Edit, for one scanned book: which series it is and which volumes it holds,
// for when the catalog got either wrong. Saving takes back what the scan put
// on the shelf and puts the corrected series and volumes on instead
// (lib/scan.ts editScan). The import's Edit (pages/Import/MatchModal.tsx)
// asks the same "which series" with the same AniList search and looks; this
// one asks for volume numbers rather than a count. A native dialog over the
// scanner: its own focus trap, Escape and backdrop.
import { DID_YOU_MEAN, withNearMatches } from "../../lib/nearMatches";
import { knownNamesNear } from "../../lib/knownNames";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { NavLink } from "react-router";
import { aniListGapMs, searchSeries, type SeriesHit } from "../../lib/anilist";
import { importStyles as styles } from "../../pages/Import/styles";
import { volumesFrom } from "../../lib/barcode";

// a search per pause in typing, not per letter, at AniList's pace
const TYPING_PAUSE_MS = 450;

type Props = {
  // as the scan found it
  name: string;
  volumes: number[];
  // the series on their shelf, for its full edit page; none for a book
  // that isn't on it yet
  id?: number;
  // A book the app couldn't tell the volumes of: the form is the question
  // "Which volumes are in this book?", and saving puts it on the shelf.
  // `edition` and `bookNumber` say which book it is ("Deluxe", 2)
  asking?: { edition: string | null; bookNumber: number | null };
  onSave: (change: { name: string; volumes: number[] }) => Promise<void>;
  onClose: () => void;
};

// which book of its edition it is, in a word or two: "Deluxe 2"
const bookOf = (asking: NonNullable<Props["asking"]>) =>
  [asking.edition, asking.bookNumber].filter(Boolean).join(" ");

type Found =
  | { state: "idle" | "searching" | "failed" }
  | { state: "done"; hits: SeriesHit[]; guessed: boolean };

export default function ScanEdit({
  name,
  volumes,
  id,
  asking,
  onSave,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = useId();
  const [search, setSearch] = useState(name);
  const [found, setFound] = useState<Found>({ state: "searching" });
  // the series picked from the results; until then, the one scanned
  const [picked, setPicked] = useState<string>(name);
  const [typed, setTyped] = useState(volumes.join(", "));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const chosen = volumesFrom(typed);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    const words = search.trim();
    if (!words) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setFound({ state: "searching" });
        withNearMatches(
          words,
          (text, retry) => searchSeries(text, controller.signal, retry),
          (hit) => hit.name,
          (text) => knownNamesNear(text, controller.signal),
        )
          .then(({ hits, guessed }) =>
            setFound({ state: "done", hits, guessed }),
          )
          .catch(() => {
            if (!controller.signal.aborted) setFound({ state: "failed" });
          });
      },
      words === name ? 0 : Math.max(TYPING_PAUSE_MS, aniListGapMs()),
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, name]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    if (picked === name && chosen.join() === volumes.join()) {
      dialog.current?.close();
      return;
    }
    setSaving(true);
    setProblem("");
    try {
      await onSave({ name: picked, volumes: chosen });
      dialog.current?.close();
    } catch {
      setProblem("That didn't save. Try again.");
      setSaving(false);
    }
  };

  const results: Found = search.trim() ? found : { state: "idle" };

  const seriesField = (
    <>
      <label htmlFor={`${ids}-search`} className={styles.modalLabel}>
        Which series is it?
      </label>
      <input
        id={`${ids}-search`}
        type="search"
        className={styles.modalSearch}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      <div
        className={styles.modalHits}
        role="radiogroup"
        aria-label="AniList series"
        aria-busy={results.state === "searching"}
      >
        {results.state === "searching" && (
          <p className={styles.modalStatus}>Searching AniList…</p>
        )}
        {results.state === "failed" && (
          <p className={styles.modalStatus} role="alert">
            Couldn't search AniList just now. The series stays as scanned unless
            you pick another.
          </p>
        )}
        {results.state === "done" && !results.hits.length && (
          <p className={styles.modalStatus}>
            No manga by that name. Check the spelling, or try a shorter one.
          </p>
        )}
        {results.state === "done" && results.guessed && (
          <p className={styles.modalStatus}>{DID_YOU_MEAN}</p>
        )}
        {results.state === "done" &&
          results.hits.slice(0, 6).map((hit) => (
            <button
              key={hit.anilistId}
              type="button"
              role="radio"
              aria-checked={picked === hit.name}
              className={styles.modalHit}
              onClick={() => setPicked(hit.name)}
            >
              {hit.cover ? (
                <img src={hit.cover} alt="" className={styles.modalCover} />
              ) : (
                <span className={styles.modalCover} />
              )}
              <span className="min-w-0">
                <span className={styles.modalHitName}>{hit.name}</span>
                {hit.year && (
                  <span className={styles.modalHitMeta}>{hit.year}</span>
                )}
              </span>
            </button>
          ))}
      </div>
    </>
  );
  const volumesField = (
    <>
      <label htmlFor={`${ids}-volumes`} className={styles.modalLabel}>
        Which volumes
      </label>
      <input
        id={`${ids}-volumes`}
        className={styles.modalVolumes}
        inputMode="numeric"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-describedby={`${ids}-volumes-hint`}
        aria-invalid={!chosen}
      />
      <p id={`${ids}-volumes-hint`} className={styles.modalHint}>
        {asking
          ? "Every volume inside it, like 4, 5, 6. It's on its back cover or first pages."
          : chosen
            ? "One number, or a few for a book holding several: 3, 4"
            : "Volume numbers, like 3 or 3, 4"}
      </p>
    </>
  );

  return (
    <dialog
      ref={dialog}
      className={styles.modal}
      aria-labelledby={`${ids}-title`}
      onClose={(e) => {
        // the scanner around it isn't closing
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <form className={styles.modalForm} onSubmit={save} noValidate>
        <div className={styles.modalHead}>
          <div className="min-w-0">
            <h2 id={`${ids}-title`} className={styles.modalTitle}>
              {asking ? "Which volumes are in this book?" : "Edit this scan"}
            </h2>
            <p className={styles.modalNow}>
              {asking ? (
                <>
                  {[name, bookOf(asking)].filter(Boolean).join(" · ")}. We
                  couldn't tell, so nothing is on your shelf yet.
                </>
              ) : (
                <>
                  Scanned as {name}, vol. {volumes.join(" & ")}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* the question first: when it's asking which volumes, that box
              leads and the series (already known) follows */}
          {asking && volumesField}
          {seriesField}
          {!asking && volumesField}
          {id !== undefined && (
            <NavLink
              to={`/update/${id}`}
              className={styles.modalHint}
              viewTransition
            >
              Chapter, status or notes? Open the series' edit page
            </NavLink>
          )}
          {problem && (
            <p className={styles.modalStatus} role="alert">
              {problem}
            </p>
          )}
        </div>

        <div className={styles.modalFoot}>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!chosen || saving}
          >
            {saving ? "Saving…" : asking ? "Add to my shelf" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

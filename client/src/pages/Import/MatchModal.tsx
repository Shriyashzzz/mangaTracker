// Edit, for one series in a book import: which AniList series it is (or none),
// and how many volumes they own, before it goes on the shelf. A native dialog:
// it brings its own focus trap, Escape and backdrop.
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  AniListBusy,
  aniListGapMs,
  searchSeries,
  type SeriesHit,
} from "../../lib/anilist";
import { gapsIn, type BookSeries } from "../../lib/imports/bookImport";
import { ownedVolumes, parseVolumes, rangesText } from "../../lib/ownedVolumes";
import type { Edit, Match } from "../../store/bookImport";
import { importStyles as styles } from "./styles";

// a search per pause in typing, not per letter, and never sooner than AniList's
// pace allows: the import's own matching shares its 30 or so a minute
const TYPING_PAUSE_MS = 450;

const FORMATS: Record<string, string> = {
  MANGA: "Manga",
  NOVEL: "Light novel",
  ONE_SHOT: "One shot",
};

type Props = {
  // the row as the list shows it, their earlier edits included
  series: BookSeries;
  // its match now, as the list shows it
  current: Match | undefined;
  // they've edited it before, so it can go back to what the import found
  edited: boolean;
  onSave: (edit: Edit) => void;
  onUndo: () => void;
  onClose: () => void;
};

type Found =
  | { state: "idle" }
  | { state: "searching" }
  | { state: "done"; hits: SeriesHit[] }
  // AniList asked us to wait: trying again by itself
  | { state: "waiting"; seconds: number }
  | { state: "unreachable" }
  | { state: "failed" };

export default function MatchModal({
  series,
  current,
  edited,
  onSave,
  onUndo,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState(series.title);
  const [found, setFound] = useState<Found>({ state: "searching" });
  // Search again, after AniList couldn't be reached
  const [tries, setTries] = useState(0);
  // undefined: unchanged; null: not on AniList
  const [picked, setPicked] = useState<SeriesHit | null | undefined>();
  // "14" is 1 to 14; "1-23, 104" is exactly those
  const [volumes, setVolumes] = useState(
    gapsIn(series.ownedList)
      ? rangesText(series.ownedList!)
      : String(series.ownedVolumes),
  );
  // a count typed in counts even when it's the one shown: it fills the gaps
  const [countTyped, setCountTyped] = useState(false);
  const ids = useId();
  const matched = current && current !== "failed" ? current : null;

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    const words = search.trim();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = (after: number) => {
      timer = setTimeout(() => {
        setFound({ state: "searching" });
        searchSeries(words, controller.signal)
          .then((hits) => setFound({ state: "done", hits }))
          .catch((e: unknown) => {
            if (controller.signal.aborted) return;
            if (e instanceof AniListBusy && e.unreachable)
              setFound({ state: "unreachable" });
            else if (e instanceof AniListBusy) {
              setFound({ state: "waiting", seconds: e.waitSeconds });
              ask(e.waitSeconds * 1000);
            } else setFound({ state: "failed" });
          });
      }, after);
    };
    // nothing typed: no search (the list shows "idle" for it)
    if (words)
      ask(
        words === series.title && !tries
          ? 0
          : Math.max(TYPING_PAUSE_MS, aniListGapMs()),
      );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, series.title, tries]);

  // results for a name that's since been cleared aren't shown, or pickable
  const results: Found = search.trim() ? found : { state: "idle" };
  const chosenId =
    picked === undefined ? matched?.anilistId : (picked?.anilistId ?? null);
  const noneChosen =
    picked === null || (picked === undefined && current === null);
  const typed = volumes.trim();
  const runTo = /^\d{1,3}$/.test(typed) ? Number(typed) : null;
  const list = runTo === null ? parseVolumes(typed) : null;
  const countOk = typed !== "" && (runTo !== null || Boolean(list?.length));

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!countOk) return;
    const edit: Edit = {};
    if (picked !== undefined)
      edit.match = picked && {
        anilistId: picked.anilistId,
        malId: picked.malId,
        name: picked.name,
        cover: picked.cover,
        fit: "exact",
      };
    if (countTyped) {
      // a list keeps its gaps; a number is a run from 1
      edit.volumes = runTo ?? Math.max(0, ...list!.filter(Number.isInteger));
      edit.list = runTo === null ? ownedVolumes(null, list).ownedList : [];
    }
    if (edit.match !== undefined || edit.volumes !== undefined) onSave(edit);
    dialog.current?.close();
  };

  return (
    <dialog
      ref={dialog}
      className={styles.modal}
      aria-labelledby={`${ids}-title`}
      onClose={onClose}
      // the backdrop counts as the dialog itself; its contents are all children
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <form className={styles.modalForm} onSubmit={save}>
        <div className={styles.modalHead}>
          <div className="min-w-0">
            <h2 id={`${ids}-title`} className={styles.modalTitle}>
              {series.title}
            </h2>
            <p className={styles.modalNow}>
              {matched
                ? `Matched to ${matched.name}`
                : current === "failed"
                  ? "Couldn't check AniList"
                  : "Not on AniList"}
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
          <label htmlFor={`${ids}-search`} className={styles.modalLabel}>
            Which series is it?
          </label>
          <input
            id={`${ids}-search`}
            type="search"
            className={styles.modalSearch}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              // the last name's results go while this one waits its turn
              setFound({ state: "searching" });
            }}
            autoComplete="off"
            enterKeyHint="search"
            onKeyDown={(e) => {
              // Enter searches; Save is its own button
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
            {results.state === "idle" && (
              <p className={styles.modalStatus}>
                Type the series' name to search AniList.
              </p>
            )}
            {results.state === "waiting" && (
              <p className={styles.modalStatus} role="status">
                AniList asked us to slow down. Searching again in{" "}
                {results.seconds} seconds.
              </p>
            )}
            {(results.state === "unreachable" ||
              results.state === "failed") && (
              <p className={styles.modalStatus} role="alert">
                {results.state === "unreachable"
                  ? "Couldn't reach AniList. Check your connection, then "
                  : "AniList didn't answer that search. "}
                <button
                  type="button"
                  className={styles.modalRetry}
                  onClick={() => setTries((n) => n + 1)}
                >
                  search again
                </button>
              </p>
            )}
            {results.state === "done" && !results.hits.length && (
              <p className={styles.modalStatus}>
                Nothing on AniList by that name. Try its Japanese name, or a
                shorter one.
              </p>
            )}
            {results.state === "done" &&
              results.hits.map((hit) => (
                <button
                  key={hit.anilistId}
                  type="button"
                  role="radio"
                  aria-checked={chosenId === hit.anilistId}
                  className={styles.modalHit}
                  onClick={() => setPicked(hit)}
                >
                  {hit.cover ? (
                    <img
                      src={hit.cover}
                      alt=""
                      loading="lazy"
                      className={styles.modalCover}
                    />
                  ) : (
                    <span className={styles.modalCover} aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={styles.modalHitName}>{hit.name}</span>
                    {hit.otherName && (
                      <span className={styles.modalHitOther}>
                        {hit.otherName}
                      </span>
                    )}
                    <span className={styles.modalHitMeta}>
                      {[
                        hit.year,
                        hit.format ? (FORMATS[hit.format] ?? "Other") : null,
                        hit.adult ? "18+" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              ))}
            <button
              type="button"
              role="radio"
              aria-checked={noneChosen}
              className={styles.modalNone}
              onClick={() => setPicked(null)}
            >
              None of these: not on AniList, leave it off my shelf
            </button>
          </div>

          <label htmlFor={`${ids}-volumes`} className={styles.modalLabel}>
            Volumes owned
          </label>
          <input
            id={`${ids}-volumes`}
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="14, or 1-5, 8"
            className={styles.modalVolumes}
            value={volumes}
            onChange={(e) => {
              setVolumes(e.target.value);
              setCountTyped(true);
            }}
            aria-describedby={`${ids}-volumes-hint`}
            aria-invalid={!countOk}
          />
          <p id={`${ids}-volumes-hint`} className={styles.modalHint}>
            {!countOk
              ? "A number (up to that volume) or a list like 1-5, 8."
              : series.omnibus
                ? "Omnibuses and box sets hold several volumes each: list the volumes, not the books (1-27, 30)."
                : "A number is every volume up to it; a list like 1-5, 8 keeps the gaps."}
          </p>
        </div>

        <div className={styles.modalFoot}>
          {edited && (
            <button
              type="button"
              className={styles.modalUndo}
              onClick={() => {
                onUndo();
                dialog.current?.close();
              }}
            >
              Undo my edits
            </button>
          )}
          <button
            type="button"
            className={styles.cancel}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={!countOk}
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}

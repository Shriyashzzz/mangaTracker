// Edit, for one series in a book import: which AniList series it is (or none),
// and how many volumes they own, before it goes on the shelf. A native dialog:
// it brings its own focus trap, Escape and backdrop.
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AniListBusy, searchSeries, type SeriesHit } from "../../lib/anilist";
import { gapsIn, type BookSeries } from "../../lib/imports/bookImport";
import type { Edit } from "../../store/bookImport";
import { importStyles as styles } from "./styles";

// a search per pause in typing, not per letter: AniList allows about 30 a minute
const TYPING_PAUSE_MS = 450;

const FORMATS: Record<string, string> = {
  MANGA: "Manga",
  NOVEL: "Light novel",
  ONE_SHOT: "One shot",
};

type Props = {
  // the series as the list shows it, their earlier edits included
  series: BookSeries;
  // its match now: a series, or null for not on AniList
  current: { anilistId?: number; name: string } | null;
  onSave: (edit: Edit) => void;
  onClose: () => void;
};

type Found =
  | { state: "searching" }
  | { state: "done"; hits: SeriesHit[] }
  | { state: "busy" }
  | { state: "failed" };

export default function MatchModal({
  series,
  current,
  onSave,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState(series.title);
  const [found, setFound] = useState<Found>({ state: "searching" });
  // undefined: unchanged; null: not on AniList
  const [picked, setPicked] = useState<SeriesHit | null | undefined>();
  const [volumes, setVolumes] = useState(String(series.ownedVolumes));
  const ids = useId();

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
        searchSeries(words, controller.signal)
          .then((hits) => setFound({ state: "done", hits }))
          .catch((e: unknown) => {
            if (controller.signal.aborted) return;
            setFound({ state: e instanceof AniListBusy ? "busy" : "failed" });
          });
      },
      // the first search straight away, with the name from their file
      words === series.title ? 0 : TYPING_PAUSE_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, series.title]);

  const chosenId =
    picked === undefined ? current?.anilistId : (picked?.anilistId ?? null);
  const noneChosen = picked === null || (picked === undefined && !current);
  const count = Number(volumes);
  const countOk =
    volumes.trim() !== "" &&
    Number.isInteger(count) &&
    count >= 0 &&
    count <= 999;
  const hadGaps = gapsIn(series.ownedList);

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
    if (count !== series.ownedVolumes) edit.volumes = count;
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
              {current ? `Matched to ${current.name}` : "Not on AniList"}
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
            onChange={(e) => setSearch(e.target.value)}
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
            aria-busy={found.state === "searching"}
          >
            {found.state === "searching" && (
              <p className={styles.modalStatus}>Searching AniList…</p>
            )}
            {found.state === "busy" && (
              <p className={styles.modalStatus} role="alert">
                AniList is busy matching your other series. Try again in a
                minute.
              </p>
            )}
            {found.state === "failed" && (
              <p className={styles.modalStatus} role="alert">
                AniList didn't answer. Check your connection and search again.
              </p>
            )}
            {found.state === "done" && !found.hits.length && (
              <p className={styles.modalStatus}>
                Nothing on AniList by that name. Try its Japanese name, or a
                shorter one.
              </p>
            )}
            {found.state === "done" &&
              found.hits.map((hit) => (
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
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            className={styles.modalVolumes}
            value={volumes}
            onChange={(e) => setVolumes(e.target.value)}
            aria-describedby={`${ids}-volumes-hint`}
            aria-invalid={!countOk}
          />
          <p id={`${ids}-volumes-hint`} className={styles.modalHint}>
            {!countOk
              ? "A whole number from 0 to 999."
              : hadGaps && count !== series.ownedVolumes
                ? "Counted from vol. 1, so the gaps in the file go."
                : series.omnibus
                  ? "Omnibuses hold several volumes each: count the volumes, not the books."
                  : "Counted from vol. 1."}
          </p>
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

// Importing from a book app: Goodreads, Book Catalogue, or any CSV. The file is
// read here in the browser, volumes are grouped into series, and each series is
// looked up on AniList for its cover and to tell manga from everything else.
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import {
  mergeSameSeries,
  editOf,
  withEdits,
  withVolumes,
  type BookSeries,
  type BookSource,
} from "../../lib/imports/bookImport";
import { timeLeft, useBookImport } from "../../store/bookImport";
import ImportList from "./ImportList";
import { openBookFiles } from "../../lib/imports/openBookFiles";
import {
  CompleteSets,
  FilesInImport,
  StopButton,
  WaitingDots,
} from "./BookImportParts";
import { useShelf } from "../../store/shelf";
import { shelfKey } from "../../lib/titleKey";
import { APP_NAME, doneTitle, foundLine, HOW, series } from "./bookImportText";

// ISBN-only rows looked up in one file, at most (the scan allows 60 a minute)
import { importStyles as styles } from "./styles";

// a left-out series' name on the last page, at most
const LONGEST_NAME_SHOWN = 60;
// files in one import

export default function BookImport({ source }: { source: BookSource }) {
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  // the import itself lives in a store, so it carries on while they're away
  const imported = useBookImport();
  // what's on the shelf already (the list loads it): the Add button counts
  // only the series that are new to it
  const shelfNow = useShelf((st) => st.manga);
  const ours = imported.source === source;
  const fileNames = ours ? imported.fileNames : [];
  const found = ours ? imported.found : null;
  const {
    matches,
    choices,
    edits,
    waitingOnAniList,
    progress,
    totals,
    failed,
    finished,
  } = imported;

  // after a reload, or back from another page: the import they'd started.
  // One that's finished is done with once they leave, so the next visit can
  // take another file
  useEffect(() => {
    useBookImport.getState().resume(source);
    return () => {
      const s = useBookImport.getState();
      if (s.finished && s.source === source) s.stop();
    };
  }, [source]);

  // one file or several, picked or dropped. Each is checked on its own: one
  // from another app is named and left out, and the rest still come in. While
  // an import of this app is going, they join it
  const open = async (picked: File[]) => {
    if (!picked.length) return;
    const joining = Boolean(ours && found);
    // can't join: say why, rather than taking the files and doing nothing
    if (joining) {
      let why: string | null = null;
      if (imported.progress !== null)
        why =
          "Wait until this import has gone on your shelf, then start a new one with that file.";
      else if (imported.finished)
        why = "This import is done. Start a new one with that file.";
      else if (!imported.books.length)
        why =
          "This import was too big for the browser to keep every book, so no more files can join it after a reload. Stop it and import all your files together.";
      if (why) {
        setFileErrors([why]);
        return;
      }
    }
    const { files, kind, errors } = await openBookFiles(
      picked.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        bytes: () => file.arrayBuffer(),
      })),
      source,
      joining ? imported.fileNames : [],
      joining ? imported.kind : null,
    );
    setFileErrors(errors);
    if (!files.length) return;
    if (joining) useBookImport.getState().addFiles(files);
    else useBookImport.getState().load(source, kind!, files);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    void open([...(e.target.files ?? [])]);
    e.target.value = "";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void open([...e.dataTransfer.files]);
  };

  // a spin-off AniList doesn't have counts as not found (withoutSpinOffs),
  // and what they chose with Edit wins
  const shown = useMemo(
    () => (found ? withEdits(found, matches, edits) : matches),
    [found, matches, edits],
  );
  const matchOf = (s: BookSeries) => shown.get(s.key);
  // kept apart as a spin-off: the series a shorter name found
  const keptApartFrom = (s: BookSeries) => {
    const raw = matches.get(s.key);
    return raw &&
      raw !== "failed" &&
      shown.get(s.key) === null &&
      editOf(s, edits)?.match === undefined
      ? raw.name
      : null;
  };
  // ticked unless they've said otherwise: found on AniList and owned or read,
  // or from their own backup
  const ticked = (s: BookSeries) => {
    // the row's own, or one made on a series that has since joined it
    const choice = (s.members ?? [s.key])
      .map((k) => choices.get(k))
      .find((c) => c !== undefined);
    if (choice !== undefined) return choice;
    // a backup's series were all on their own shelf: every one goes back,
    // the ones AniList doesn't know and the ones on To read too
    if (s.restore) return true;
    const match = matchOf(s);
    // every book from a novel publisher: the novel AniList has a manga of
    // by the same name (lib/imports/novelPublisher.ts)
    return (
      Boolean(match && match !== "failed") && !s.planned && !s.novelPublisher
    );
  };
  // rows AniList says are one series, as one
  const rows = found
    ? mergeSameSeries(found, (s) => {
        const match = shown.get(s.key);
        return match && match !== "failed" ? match.anilistId : null;
      }).map((s) => withVolumes(s, edits))
    : null;
  const chosen = (rows ?? []).filter(ticked);
  // what Select all can tick: anything matched, as a row's own box can be
  const tickable = (rows ?? []).filter((s) => matchOf(s) !== undefined);
  const allTicked = tickable.length > 0 && tickable.every(ticked);
  const checked = (found ?? []).filter((s) => matches.has(s.key)).length;
  const lookingUp = Boolean(found) && checked < (found?.length ?? 0);

  const start = () => void imported.add(chosen);
  // the series ticked that aren't on the shelf yet: the button counts these,
  // so the same file a second time doesn't offer to "Add 33 series"
  const onShelf = new Set(
    (shelfNow ?? []).map((m) => shelfKey(m.name, Boolean(m.lightNovel))),
  );
  const nameOf = (s: BookSeries) => {
    const match = matchOf(s);
    return match && match !== "failed" ? match.name : s.title;
  };
  const newOnes = chosen.filter(
    (s) => !onShelf.has(shelfKey(nameOf(s), Boolean(s.lightNovel))),
  ).length;
  // left unticked, by them or as never found: said on the last page, so
  // none goes without a word. A title past a line long (a junk row) is cut
  const leftOut = (rows ?? [])
    .filter((s) => !ticked(s))
    .map(nameOf)
    .map((name) =>
      name.length > LONGEST_NAME_SHOWN
        ? `${name.slice(0, LONGEST_NAME_SHOWN).trimEnd()}…`
        : name,
    );

  if (ours && finished && totals) {
    return (
      <section className={`${styles.sheet} ${styles.result}`}>
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="happy" />
        </span>
        <h2 className={styles.resultTitle} role="status">
          {doneTitle(totals)}
        </h2>
        <p className={styles.resultBody}>
          {totals.alreadyThere > 0 &&
            (totals.volumesAdded
              ? `${series(totals.alreadyThere)} already on your shelf; ${series(totals.volumesAdded)} got the new volumes from your file, nothing else changed. `
              : `${series(totals.alreadyThere)} already on your shelf, so we left them alone. `)}
          {totals.noCover > 0 &&
            `${series(totals.noCover)} came in without a cover. You can add one with Edit details.`}
        </p>
        {leftOut.length > 0 && (
          <p className={styles.resultBody}>
            Not added, as they weren't ticked: {leftOut.slice(0, 5).join(", ")}
            {leftOut.length > 5 && ` and ${leftOut.length - 5} more`}
            {/* a cut name ends in "…" already */}
            {leftOut.length > 5 || !leftOut.at(-1)?.endsWith("…") ? "." : ""}
          </p>
        )}
        <CompleteSets ids={totals.completeSets ?? []} />
        <NavLink
          to="/shelf"
          className="btn btn-primary btn-lg mt-2"
          viewTransition
        >
          Go to my shelf
        </NavLink>
      </section>
    );
  }

  const importing = progress !== null;
  const how = HOW[source];

  return (
    <>
      <section className={styles.sheet} aria-label="How to import">
        <div className={styles.step}>
          <span className={styles.stepNumber} aria-hidden>
            1
          </span>
          <div>
            <h2 className={styles.stepTitle}>Export your library</h2>
            <p className={styles.stepBody}>{how.step}</p>
            {how.points && (
              <ul className={styles.noteList}>
                {how.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
            {how.link && (
              <a
                className={styles.stepLink}
                href={how.link.href}
                target="_blank"
                rel="noreferrer"
              >
                {how.link.label}
                <span className="sr-only"> (opens in a new tab)</span> →
              </a>
            )}
          </div>
        </div>

        <div className={styles.step}>
          <span className={styles.stepNumber} aria-hidden>
            2
          </span>
          <div>
            <h2 className={styles.stepTitle}>
              {found ? "Add another file" : "Add the file here"}
            </h2>
            <label
              className={`${styles.drop} ${dragging ? styles.dropActive : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                className={styles.dropInput}
                type="file"
                accept=".csv,text/csv"
                multiple
                disabled={importing}
                onChange={onPick}
              />
              <span>
                <span className={`${styles.dropTitle} block`}>
                  {found ? "Choose another file" : "Choose your file"}
                </span>
                <span className={`${styles.dropHint} block`}>
                  {found
                    ? source === "csv"
                      ? "Another export from the same app joins this one, matched as it goes"
                      : `Another ${APP_NAME[source]} export joins this one, matched as it goes`
                    : "Or drop it here, or several. They end in .csv"}
                </span>
              </span>
            </label>
            {fileErrors.length > 0 && (
              <div role="alert">
                {fileErrors.map((error) => (
                  <p key={error} className={styles.error}>
                    {error}
                  </p>
                ))}
              </div>
            )}
            {ours && imported.stopped && !found && (
              <p className={styles.note} role="status">
                {imported.stopped.added
                  ? `Stopped after adding ${series(imported.stopped.added)}. Anything already added is skipped if you import again.`
                  : "Stopped. Nothing was added, and you can import again any time."}
              </p>
            )}
          </div>
        </div>

        {source === "csv" && (
          <p className={styles.warning}>
            Every app exports its own way, so there's no guarantee every book
            comes over exactly right. Check the list before you add it.
          </p>
        )}
      </section>

      {found && (
        <section className={styles.sheet} aria-labelledby="import-found">
          <div>
            <h2 id="import-found" className={styles.found}>
              {foundLine(rows!)}
            </h2>
            <FilesInImport names={fileNames} />

            {lookingUp && (
              <div className={styles.matchingLine}>
                <p className={styles.note} role="status">
                  {waitingOnAniList ? (
                    <>
                      AniList asked us to slow down, so we're waiting a moment
                      <WaitingDots />
                    </>
                  ) : (
                    `Matching with AniList: ${checked} of ${found.length}, ${timeLeft(found.length - checked)}…`
                  )}
                </p>
                <StopButton />
              </div>
            )}

            <div
              className={
                lookingUp ? styles.listToolsMatching : styles.listTools
              }
            >
              {lookingUp && (
                <p className={"font-body"}>
                  Feel free to explore. This takes a while.
                </p>
              )}
              <button
                type="button"
                className={styles.selectAll}
                disabled={importing || !tickable.length}
                onClick={() =>
                  imported.chooseAll(
                    tickable.map((s) => s.key),
                    !allTicked,
                  )
                }
              >
                {allTicked ? "Clear all" : "Select all"}
              </button>
            </div>
            <ImportList
              found={found}
              rows={rows!}
              matchOf={matchOf}
              keptApartFrom={keptApartFrom}
              ticked={ticked}
              importing={importing}
              lookingUp={lookingUp}
            />

            {/* one thing a line: what happens to the file */}
            <ul className={styles.noteList}>
              <li>Each series comes in once, however many books it has.</li>
              <li>
                Ticked: the manga you bought or read. Untick any to leave out.
              </li>
              <li>The volumes you own keep their gaps.</li>
              <li>
                A box set or omnibus that doesn't say its volumes is marked to
                check.
              </li>
              <li>A series already on your shelf only gets its new volumes.</li>
              <li>
                Price Paid and Date Purchased columns are kept on each book.
              </li>
            </ul>

            {importing ? (
              <div className="mt-5" role="status">
                <div className={styles.matchingLine}>
                  <p className={styles.progressLine}>
                    {imported.waiting
                      ? `${progress} of ${imported.adding} added. Pausing a minute, then carrying on…`
                      : `Adding ${progress} of ${imported.adding}…`}
                  </p>
                  <StopButton />
                </div>
                <div className={styles.bar} aria-hidden>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${(progress / Math.max(imported.adding, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={!chosen.length || lookingUp}
                  onClick={start}
                >
                  {lookingUp
                    ? "Matching…"
                    : newOnes
                      ? `Add ${series(newOnes)} to my shelf`
                      : `Update ${series(chosen.length)} on my shelf`}
                </button>
                {/* while matching, Stop import above does this */}
                {!lookingUp && <StopButton cancel />}
              </div>
            )}

            {failed && (
              <p className={styles.error} role="alert">
                That stopped partway
                {totals?.added ? `, after adding ${series(totals.added)}` : ""}
                {failed === "Import failed" ? "" : ` (${failed})`}. Try again
                and anything already added will be skipped.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

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
  fileKind,
  mergeSameSeries,
  parseCsv,
  editOf,
  withEdits,
  withVolumes,
  readBooks,
  wrongFile,
  bookFromScan,
  isbnOnlyRows,
  type BookSeries,
  type BookSource,
  type FileKind,
} from "../../lib/imports/bookImport";
import {
  timeLeft,
  useBookImport,
  type ImportFile,
} from "../../store/bookImport";
import ImportList from "./ImportList";
import { getJson } from "../../lib/api";
import { FilesInImport, StopButton, WaitingDots } from "./BookImportParts";
import { APP_NAME, foundLine, HOW, series } from "./bookImportText";

// ISBN-only rows looked up in one file, at most (the scan allows 60 a minute)
const MAX_ISBN_LOOKUPS = 50;
import { importStyles as styles } from "./styles";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
// files in one import
const MAX_FILES = 5;

export default function BookImport({ source }: { source: BookSource }) {
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  // the import itself lives in a store, so it carries on while they're away
  const imported = useBookImport();
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
      const why =
        imported.progress !== null
          ? "Wait until this import has gone on your shelf, then start a new one with that file."
          : imported.finished
            ? "This import is done. Start a new one with that file."
            : !imported.books.length
              ? "This import was too big for the browser to keep every book, so no more files can join it after a reload. Stop it and import all your files together."
              : null;
      if (why) {
        setFileErrors([why]);
        return;
      }
    }
    const already = joining ? imported.fileNames : [];
    let kind: FileKind | null = joining ? imported.kind : null;
    const errors: string[] = [];
    let unknownIsbns = 0;
    const files: ImportFile[] = [];
    // oldest first, so the newest export has the last word on ratings
    const inOrder = [...picked].sort((a, b) => a.lastModified - b.lastModified);
    for (const file of inOrder) {
      if (already.length + files.length >= MAX_FILES) {
        errors.push(
          `${file.name} wasn't added: one import takes up to ${MAX_FILES} files.`,
        );
        continue;
      }
      if ([...already, ...files.map((f) => f.name)].includes(file.name)) {
        errors.push(`${file.name} is already in this import.`);
        continue;
      }
      if (!/\.csv$/i.test(file.name) && !/csv/i.test(file.type)) {
        errors.push(
          `${file.name} isn't a CSV file. Library exports end in .csv.`,
        );
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        errors.push(
          `${file.name} is too big to be a library export. Check you picked the right one.`,
        );
        continue;
      }
      try {
        const rows = parseCsv(await file.text());
        const headers = (rows[0] ?? []).map((h) => h.trim());
        // on the Book Catalogue tab, an older export with just a lowercase
        // "title" column (as Book Catalogue writes it) is taken at its word,
        // as it always was; other tabs still want its own columns
        const plainKind = fileKind(headers);
        const thisKind: FileKind =
          source === "bookcatalogue" &&
          plainKind === "csv" &&
          headers.includes("title")
            ? "bookcatalogue"
            : plainKind;
        const wrong = wrongFile(file.name, source, thisKind, kind);
        if (wrong) {
          errors.push(wrong);
          continue;
        }
        const books = readBooks(rows, source);
        // rows with only an ISBN are looked up, as a scanned barcode is
        // (a few at a time, under the scan's own limit)
        const isbns = isbnOnlyRows(rows).slice(0, MAX_ISBN_LOOKUPS);
        for (const isbn of isbns) {
          const scan = await getJson<Parameters<typeof bookFromScan>[0]>(
            `/api/prices/scan/${isbn}`,
          ).catch(() => null);
          if (scan) books.push(bookFromScan(scan));
          else unknownIsbns++;
        }
        if (!books.length) {
          errors.push(
            source === "csv" && thisKind === "csv"
              ? `We couldn't find a title column in ${file.name}.`
              : `There are no books in ${file.name}.`,
          );
          continue;
        }
        kind = thisKind;
        files.push({ name: file.name, books });
      } catch {
        errors.push(`${file.name} couldn't be read. Try exporting it again.`);
      }
    }
    if (unknownIsbns)
      errors.push(
        `${unknownIsbns} ${unknownIsbns === 1 ? "row has" : "rows have"} only an ISBN the book catalog doesn't know. Add ${unknownIsbns === 1 ? "it" : "them"} by title.`,
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
  // ticked unless they've said otherwise: found on AniList and owned or read
  const ticked = (s: BookSeries) => {
    // the row's own, or one made on a series that has since joined it
    const choice = (s.members ?? [s.key])
      .map((k) => choices.get(k))
      .find((c) => c !== undefined);
    if (choice !== undefined) return choice;
    const match = matchOf(s);
    return Boolean(match && match !== "failed") && !s.planned;
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

  if (ours && finished && totals) {
    return (
      <section className={`${styles.sheet} ${styles.result}`}>
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="happy" />
        </span>
        <h2 className={styles.resultTitle} role="status">
          {totals.added
            ? `${series(totals.added)} added!`
            : totals.volumesAdded
              ? "Volumes added!"
              : "All already there!"}
        </h2>
        <p className={styles.resultBody}>
          {totals.alreadyThere > 0 &&
            (totals.volumesAdded
              ? `${series(totals.alreadyThere)} already on your shelf; ${series(totals.volumesAdded)} got the new volumes from your file, nothing else changed. `
              : `${series(totals.alreadyThere)} already on your shelf, so we left them alone. `)}
          {totals.noCover > 0 &&
            `${series(totals.noCover)} came in without a cover. You can add one with Edit details.`}
        </p>
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

            <p className={styles.note}>
              1) Volumes are grouped by series, so each manga comes in once.
              Ticked: what AniList knows as manga, that you've bought or read.{" "}
              <br />
              2) Volumes owned are the ones you bought, gaps and all. A box set
              or omnibus that doesn't say which volumes it holds is marked to
              check. <br />
              3) A series already on your shelf gets the new volumes added.
              Prices paid and dates bought aren't kept.{" "}
            </p>

            {importing ? (
              <div className="mt-5" role="status">
                <div className={styles.matchingLine}>
                  <p className={styles.progressLine}>
                    Adding {progress} of {imported.adding}…
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
                  disabled={!chosen.length}
                  onClick={start}
                >
                  Add {series(chosen.length)} to my shelf
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

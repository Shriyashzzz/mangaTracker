// Importing from a book app: Goodreads, Book Catalogue, or any CSV. The file is
// read here in the browser, volumes are grouped into series, and each series is
// looked up on AniList for its cover and to tell manga from everything else.
import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import {
  fileKind,
  mergeSameSeries,
  parseCsv,
  readBooks,
  wrongFile,
  type BookSeries,
  type BookSource,
  type FileKind,
} from "../../lib/imports/bookImport";
import {
  timeLeft,
  useBookImport,
  type ImportFile,
} from "../../store/bookImport";
import { importStyles as styles } from "./styles";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
// files in one import
const MAX_FILES = 5;

// "goodreads.csv", or "2 files: goodreads 2023.csv, goodreads 2026.csv"
const filesLine = (names: string[]) =>
  names.length > 1
    ? `${names.length} files: ${names.join(", ")}`
    : (names[0] ?? "");

const APP_NAME: Record<BookSource, string> = {
  goodreads: "Goodreads",
  bookcatalogue: "Book Catalogue",
  csv: "your app's",
};

const series = (n: number) => `${n.toLocaleString()} series`;
const books = (n: number) => `${n.toLocaleString()} book${n === 1 ? "" : "s"}`;

// each row is a book; volumes of one series come in as one
const foundLine = (found: BookSeries[]) => {
  const rows = found.reduce((sum, s) => sum + s.books, 0);
  return rows === found.length
    ? `${books(rows)} found`
    : `${books(rows)} found, grouped into ${series(found.length)}`;
};

const HOW: Record<
  BookSource,
  { step: string; link?: { href: string; label: string } }
> = {
  goodreads: {
    step: "On Goodreads, go to My Books, then Import and export, and press Export Library. Download the file once it's ready.",
    link: {
      href: "https://www.goodreads.com/review/import",
      label: "Open Goodreads' export page",
    },
  },
  bookcatalogue: {
    step: "In Book Catalogue, open the menu and export your books to a CSV file. Go to Admin & Prefs or Settings, depending on your version. Then drop the file.",
  },
  csv: {
    step: "Export your library from your app as a CSV file.",
  },
};

const CONFIRM_FOR_MS = 5000;

// Stop import: a second tap says yes, so a stray one doesn't throw away a long
// match. Left alone, it goes back to how it was
function StopButton() {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = window.setTimeout(() => setAsking(false), CONFIRM_FOR_MS);
    return () => clearTimeout(timer);
  }, [asking]);
  if (!asking) {
    return (
      <button
        type="button"
        className={styles.stop}
        onClick={() => setAsking(true)}
      >
        Stop import
      </button>
    );
  }
  return (
    <span className={styles.stopAsk} role="group" aria-label="Stop the import?">
      <span>Stop and clear?</span>
      <button
        type="button"
        className={styles.stopYes}
        onClick={() => useBookImport.getState().stop()}
      >
        Yes
      </button>
      <button
        type="button"
        className={styles.stop}
        autoFocus
        onClick={() => setAsking(false)}
      >
        Keep going
      </button>
    </span>
  );
}

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
    const already = joining ? imported.fileNames : [];
    let kind: FileKind | null = joining ? imported.kind : null;
    const errors: string[] = [];
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
        const thisKind = fileKind(headers);
        const wrong = wrongFile(file.name, source, thisKind, kind);
        if (wrong) {
          errors.push(wrong);
          continue;
        }
        const books = readBooks(rows, source);
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

  const matchOf = (s: BookSeries) => matches.get(s.key);
  // ticked unless they've said otherwise: found on AniList and owned or read
  const ticked = (s: BookSeries) => {
    const choice = choices.get(s.key);
    if (choice !== undefined) return choice;
    const match = matchOf(s);
    return Boolean(match && match !== "failed") && !s.planned;
  };
  // rows AniList says are one series, as one
  const rows = found
    ? mergeSameSeries(found, (s) => {
        const match = matches.get(s.key);
        return match && match !== "failed" ? match.anilistId : null;
      })
    : null;
  const chosen = (rows ?? []).filter(ticked);
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
            : "All already there!"}
        </h2>
        <p className={styles.resultBody}>
          {totals.alreadyThere > 0 &&
            `${series(totals.alreadyThere)} already on your shelf, so we left them alone. `}
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
                    ? `Another ${APP_NAME[source]} export joins this one, matched as it goes`
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
            <p className={styles.fileName}>{filesLine(fileNames)}</p>

            {lookingUp && (
              <div className={styles.matchingLine}>
                <p className={styles.note} role="status">
                  {waitingOnAniList
                    ? "AniList asked us to slow down, so we're waiting a moment…"
                    : `Matching with AniList: ${checked} of ${found.length}, ${timeLeft(found.length - checked)}…`}
                </p>
                <StopButton />
              </div>
            )}

            <div
              className={styles.seriesList}
              role="group"
              aria-label="Series to add"
            >
              {rows!.map((s) => {
                const match = matchOf(s);
                const name = match && match !== "failed" ? match.name : s.title;
                return (
                  <label key={s.key} className={styles.list}>
                    <input
                      className={styles.listCheck}
                      type="checkbox"
                      checked={ticked(s)}
                      disabled={importing || match === undefined}
                      onChange={() => imported.choose(s.key, !ticked(s))}
                    />
                    <span className={styles.seriesText}>
                      <span className={styles.listName}>{name}</span>
                      <span className={styles.seriesMeta}>
                        {match === undefined
                          ? "Matching…"
                          : match === "failed"
                            ? "Couldn't check AniList"
                            : match === null
                              ? s.lightNovel
                                ? "Not on AniList"
                                : "Not on AniList, so probably not manga"
                              : (s.lightNovel ? "Light novel · " : "") +
                                (s.planned
                                  ? "Only on a to-read list"
                                  : s.ownedVolumes
                                    ? `Own up to vol. ${s.ownedVolumes}`
                                    : `${s.books} book${s.books === 1 ? "" : "s"}`)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <p className={styles.note}>
              1) Volumes are grouped by series, so each manga comes in once.
              Ticked: what AniList knows as manga, that you've bought or read.{" "}
              <br />
              2) Volumes owned is the furthest volume you bought, or read if
              that's further. <br />
              3) Chapters start blank, and anything already on your shelf gets
              skipped.{" "}
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

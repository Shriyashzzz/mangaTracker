import {
  useEffect,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { NavLink, useNavigate } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import { signInPath } from "../../lib/api";
import {
  ImportFileError,
  MAL_LISTS,
  readMalExport,
  sendToShelf,
  type ImportTotals,
  type MalItem,
} from "../../lib/imports/malImport";
import { usePrivatePage } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";
import type { BookSource } from "../../lib/imports/bookImport";
import BookImport from "./BookImport";
import {
  bookImportBusy,
  savedSource,
  useBookImport,
} from "../../store/bookImport";
import {
  readAniList,
  readKitsu,
  type AccountSource,
} from "../../lib/imports/accountImport";
import { importStyles as styles } from "./styles";

const EXPORT_PAGE = "https://myanimelist.net/panel.php?go=export";

const series = (n: number) => `${n} series`;

type Source = "mal" | AccountSource | BookSource;
const BOOK_SOURCES: Source[] = ["goodreads", "bookcatalogue", "csv"];
const isBookSource = (s: Source): s is BookSource => BOOK_SOURCES.includes(s);

const SOURCES: { id: Source; label: string }[] = [
  { id: "mal", label: "MyAnimeList" },
  { id: "anilist", label: "AniList" },
  { id: "kitsu", label: "Kitsu" },
  { id: "goodreads", label: "Goodreads" },
  { id: "bookcatalogue", label: "Book Catalogue" },
  { id: "csv", label: "Other app (CSV)" },
];

export function ImportPage() {
  usePrivatePage("Import your list");
  // a book import still going (or ready to add) opens on its own app
  const [source, setSource] = useState<Source>(
    () => useBookImport.getState().source ?? savedSource() ?? "mal",
  );
  const [username, setUsername] = useState("");
  const [finding, setFinding] = useState(false);
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const navigate = useNavigate();
  const [fileName, setFileName] = useState("");
  const [items, setItems] = useState<MalItem[] | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<number | null>(null);
  const [totals, setTotals] = useState<ImportTotals | null>(null);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  // a book app's import matching or adding, wherever it was started
  const bookBusy = useBookImport(bookImportBusy);
  const bookSource = useBookImport((s) => s.source);

  useEffect(() => {
    if (isSignedIn === false)
      navigate(signInPath("/import"), { replace: true });
  }, [isSignedIn, navigate]);

  // a fresh start for each place a list can come from
  const pickSource = (next: Source) => {
    setSource(next);
    setItems(null);
    setFileError("");
    setFileName("");
    setFailed(false);
  };

  const showFound = (found: MalItem[], empty: string) => {
    if (!found.length) {
      setFileError(empty);
      return;
    }
    setItems(found);
    setUnticked(
      new Set(
        MAL_LISTS.filter((list) => !list.importByDefault).map((l) => l.status),
      ),
    );
  };

  // AniList or Kitsu: their public list, by username
  const findList = async (e: FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name || source === "mal" || isBookSource(source)) return;
    setFileError("");
    setItems(null);
    setFailed(false);
    setFinding(true);
    try {
      const found = await (source === "anilist"
        ? readAniList(name)
        : readKitsu(name));
      setFileName(`${name} on ${source === "anilist" ? "AniList" : "Kitsu"}`);
      showFound(found, "That list has no manga on it yet.");
    } catch (err) {
      setFileError(
        err instanceof ImportFileError
          ? err.message
          : "That list couldn't be reached. Check your connection and try again.",
      );
    } finally {
      setFinding(false);
    }
  };

  const countOf = (status: string) =>
    (items ?? []).filter((item) => item.status === status).length;
  const chosen = (items ?? []).filter((item) => !unticked.has(item.status));

  const open = async (file: File | undefined) => {
    if (!file) return;
    setFileError("");
    setItems(null);
    setFailed(false);
    setFileName(file.name);
    try {
      const found = await readMalExport(file);
      if (!found.length) {
        setFileError(
          "That list is empty. Add some manga on MyAnimeList, then export it again.",
        );
        return;
      }
      setItems(found);
      setUnticked(
        new Set(
          MAL_LISTS.filter((list) => !list.importByDefault).map(
            (l) => l.status,
          ),
        ),
      );
    } catch (e) {
      setFileError(
        e instanceof ImportFileError
          ? e.message
          : "That file couldn't be read. Try downloading it again.",
      );
    }
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    void open(e.target.files?.[0]);
    // so picking the same file again still counts as a change
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void open(e.dataTransfer.files[0]);
  };

  const toggle = (status: string) => {
    const next = new Set(unticked);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setUnticked(next);
  };

  const start = async () => {
    setFailed(false);
    setProgress(0);
    try {
      const done = await sendToShelf(
        chosen.map((item) => item.entry),
        (sent, soFar) => {
          setProgress(sent);
          setTotals(soFar);
        },
      );
      setTotals(done);
      setFinished(true);
      // the shelf picks up what's new when they go back to it
      void useShelf.getState().load();
    } catch (e) {
      const soFar = (e as { totals?: ImportTotals }).totals;
      if (soFar) setTotals(soFar);
      setFailed(true);
      void useShelf.getState().load();
    } finally {
      setProgress(null);
    }
  };

  if (!isSignedIn) return null;

  if (finished && totals) {
    return (
      <div className={`${styles.page} fade-in`}>
        <section className={`${styles.sheet} ${styles.result}`}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="happy" />
          </span>
          <h1 className={styles.resultTitle} role="status">
            {totals.added
              ? `${series(totals.added)} added!`
              : "All already there!"}
          </h1>
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
      </div>
    );
  }

  const importing = progress !== null;
  // the app whose import is working: the other apps wait until it's done, so
  // switching can't drop it halfway
  const busySource = importing ? source : bookBusy ? bookSource : null;

  return (
    <div className={`${styles.page} fade-in`}>
      <div>
        <NavLink to="/shelf" className={styles.back} viewTransition>
          ← back to the shelf
        </NavLink>
        <h1 className={styles.title}>Import your list</h1>
      </div>

      <div
        className={styles.sources}
        role="group"
        aria-label="Where your list is"
      >
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={styles.source}
            aria-pressed={source === s.id}
            disabled={busySource !== null && s.id !== busySource}
            aria-describedby={busySource ? "import-lock" : undefined}
            // the one already open: picking it again would start it over
            onClick={() => s.id !== source && pickSource(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {busySource && (
        <p id="import-lock" className={styles.lockNote}>
          Switch apps once this import is done.
        </p>
      )}

      {isBookSource(source) ? (
        <BookImport key={source} source={source} />
      ) : (
        <>
          {source !== "mal" ? (
            <section className={styles.sheet} aria-label="How to import">
              <form className={styles.step} onSubmit={findList}>
                <span className={styles.stepNumber} aria-hidden>
                  1
                </span>
                <div>
                  <label htmlFor="import-username" className={styles.stepTitle}>
                    Your {source === "anilist" ? "AniList" : "Kitsu"} username
                  </label>
                  <p className={styles.stepBody}>
                    We read your public manga list from{" "}
                    {source === "anilist" ? "AniList" : "Kitsu"}. No password,
                    and nothing changes there.
                  </p>
                  <div className={styles.usernameRow}>
                    <input
                      id="import-username"
                      className={styles.usernameInput}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      maxLength={60}
                      disabled={finding || importing}
                      required
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={finding || importing || !username.trim()}
                    >
                      {finding ? "Finding…" : "Find my list"}
                    </button>
                  </div>
                  {fileError && (
                    <p className={styles.error} role="alert">
                      {fileError}
                    </p>
                  )}
                </div>
              </form>
            </section>
          ) : (
            <section className={styles.sheet} aria-label="How to import">
              <div className={styles.step}>
                <span className={styles.stepNumber} aria-hidden>
                  1
                </span>
                <div>
                  <h2 className={styles.stepTitle}>Download your manga list</h2>
                  <p className={styles.stepBody}>
                    On the export page, choose Manga and press Export.
                  </p>
                  <a
                    className={styles.stepLink}
                    href={EXPORT_PAGE}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open the export page
                    <span className="sr-only"> (opens in a new tab)</span> →
                  </a>
                </div>
              </div>

              <div className={styles.step}>
                <span className={styles.stepNumber} aria-hidden>
                  2
                </span>
                <div>
                  <h2 className={styles.stepTitle}>Add the file here</h2>
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
                      accept=".xml,.gz,.zip"
                      disabled={importing}
                      onChange={onPick}
                    />
                    <span>
                      <span className={`${styles.dropTitle} block`}>
                        Choose your file
                      </span>
                      <span className={`${styles.dropHint} block`}>
                        Or drop it here. It's the one ending in .xml.gz
                      </span>
                    </span>
                  </label>
                  {fileError && (
                    <p className={styles.error} role="alert">
                      {fileError}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {items && (
            <section className={styles.sheet} aria-labelledby="import-found">
              <div>
                <h2 id="import-found" className={styles.found}>
                  {series(items.length)} found
                </h2>
                <p className={styles.fileName}>{fileName}</p>

                <div
                  className={styles.lists}
                  role="group"
                  aria-label="Lists to add"
                >
                  {MAL_LISTS.filter((list) => countOf(list.status) > 0).map(
                    (list) => (
                      <label key={list.status} className={styles.list}>
                        <input
                          className={styles.listCheck}
                          type="checkbox"
                          checked={!unticked.has(list.status)}
                          disabled={importing}
                          onChange={() => toggle(list.status)}
                        />
                        <span className={styles.listName}>{list.label}</span>
                        <span className={styles.listCount}>
                          {countOf(list.status)}
                        </span>
                      </label>
                    ),
                  )}
                </div>

                <p className={styles.note}>
                  Anything already on your shelf gets skipped. Volumes you've
                  read count as volumes you own, unless your list says what you
                  own. You can change that on each manga's page.
                </p>

                {importing ? (
                  <div className="mt-5" role="status">
                    <p className={styles.progressLine}>
                      Adding {progress} of {chosen.length}…
                    </p>
                    <div className={styles.bar} aria-hidden>
                      <div
                        className={styles.barFill}
                        style={{
                          width: `${(progress / chosen.length) * 100}%`,
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
                    {totals?.added
                      ? `, after adding ${series(totals.added)}`
                      : ""}
                    . Try again and anything already added will be skipped.
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

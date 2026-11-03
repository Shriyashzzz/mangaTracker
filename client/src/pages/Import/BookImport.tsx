// Importing from a book app: Goodreads, Book Catalogue, or any CSV. The file is
// read here in the browser, volumes are grouped into series, and each series is
// looked up on AniList for its cover and to tell manga from everything else.
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import { AniListBusy, findManga } from "../../lib/anilist";
import {
  groupBooks,
  isBookCatalogue,
  isGoodreads,
  parseCsv,
  readBooks,
  toEntry,
  type BookSeries,
  type BookSource,
} from "../../lib/imports/bookImport";
import { sendToShelf, type ImportTotals } from "../../lib/imports/malImport";
import { useShelf } from "../../store/shelf";
import { importStyles as styles } from "./styles";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
// AniList allows about 30 to 90 lookups a minute
const LOOKUP_GAP_MS = 900;

const series = (n: number) => `${n} series`;
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

type Match =
  | { malId: number | null; name: string; cover: string | null }
  | null
  | "failed";

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

const NOT_THAT: Record<BookSource, string> = {
  goodreads:
    "That isn't a Goodreads export. Pick the file you downloaded from Goodreads' export page.",
  bookcatalogue:
    "That isn't a Book Catalogue export. If it's from another app, choose Other app instead.",
  csv: "We couldn't find a title column in that file.",
};

export default function BookImport({ source }: { source: BookSource }) {
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [found, setFound] = useState<BookSeries[] | null>(null);
  const [matches, setMatches] = useState<Map<string, Match>>(new Map());
  const [choices, setChoices] = useState<Map<string, boolean>>(new Map());
  const [waitingOnAniList, setWaitingOnAniList] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [totals, setTotals] = useState<ImportTotals | null>(null);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const lookups = useRef<AbortController | null>(null);

  useEffect(() => () => lookups.current?.abort(), []);

  // one at a time, so AniList isn't flooded; the list fills in as answers arrive
  const lookUp = async (list: BookSeries[]) => {
    lookups.current?.abort();
    const controller = new AbortController();
    lookups.current = controller;
    // what they've owned or read first, to-read lists last
    const order = [...list].sort(
      (a, b) => Number(a.planned) - Number(b.planned),
    );
    for (const s of order) {
      if (controller.signal.aborted) return;
      let match: Match = "failed";
      for (
        let attempt = 0;
        attempt < 3 && !controller.signal.aborted;
        attempt++
      ) {
        try {
          match = await findManga(s.title, controller.signal, s.lightNovel);
          break;
        } catch (e) {
          if (!(e instanceof AniListBusy)) break;
          setWaitingOnAniList(true);
          await sleep(e.waitSeconds * 1000, controller.signal);
          setWaitingOnAniList(false);
        }
      }
      if (controller.signal.aborted) return;
      setMatches((old) => new Map(old).set(s.key, match));
      await sleep(LOOKUP_GAP_MS, controller.signal);
    }
  };

  const open = async (file: File | undefined) => {
    if (!file) return;
    setFileError("");
    setFound(null);
    setMatches(new Map());
    setChoices(new Map());
    setFailed(false);
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setFileError(
        "That file is too big to be a library export. Check you picked the right one.",
      );
      return;
    }
    try {
      const rows = parseCsv(await file.text());
      const headers = (rows[0] ?? []).map((h) => h.trim());
      const right =
        source === "goodreads"
          ? isGoodreads(headers)
          : source === "bookcatalogue"
            ? isBookCatalogue(headers) || headers.includes("title")
            : true;
      const list = right ? groupBooks(readBooks(rows, source)) : [];
      if (!right || !list.length) {
        setFileError(
          right ? "There are no books in that file." : NOT_THAT[source],
        );
        return;
      }
      setFound(list);
      void lookUp(list);
    } catch {
      setFileError("That file couldn't be read. Try exporting it again.");
    }
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    void open(e.target.files?.[0]);
    e.target.value = "";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void open(e.dataTransfer.files[0]);
  };

  const matchOf = (s: BookSeries) => matches.get(s.key);
  // ticked unless they've said otherwise: found on AniList and owned or read
  const ticked = (s: BookSeries) => {
    const choice = choices.get(s.key);
    if (choice !== undefined) return choice;
    const match = matchOf(s);
    return Boolean(match && match !== "failed") && !s.planned;
  };
  const chosen = (found ?? []).filter(ticked);
  const checked = (found ?? []).filter((s) => matches.has(s.key)).length;
  const lookingUp = Boolean(found) && checked < (found?.length ?? 0);

  const start = async () => {
    setFailed(false);
    setProgress(0);
    try {
      const done = await sendToShelf(
        chosen.map((s) => {
          const match = matchOf(s);
          return toEntry(s, match && match !== "failed" ? match : undefined);
        }),
        (sent, soFar) => {
          setProgress(sent);
          setTotals(soFar);
        },
      );
      setTotals(done);
      setFinished(true);
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

  if (finished && totals) {
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
                accept=".csv,text/csv"
                disabled={importing}
                onChange={onPick}
              />
              <span>
                <span className={`${styles.dropTitle} block`}>
                  Choose your file
                </span>
                <span className={`${styles.dropHint} block`}>
                  Or drop it here. It ends in .csv
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
              {series(found.length)} found
            </h2>
            <p className={styles.fileName}>{fileName}</p>

            {lookingUp && (
              <p className={styles.note} role="status">
                {waitingOnAniList
                  ? "AniList asked us to slow down, so we're waiting a moment…"
                  : `Matching with AniList: ${checked} of ${found.length}…`}
              </p>
            )}

            <div
              className={styles.seriesList}
              role="group"
              aria-label="Series to add"
            >
              {found.map((s) => {
                const match = matchOf(s);
                const name = match && match !== "failed" ? match.name : s.title;
                return (
                  <label key={s.key} className={styles.list}>
                    <input
                      className={styles.listCheck}
                      type="checkbox"
                      checked={ticked(s)}
                      disabled={importing || match === undefined}
                      onChange={() =>
                        setChoices((old) => new Map(old).set(s.key, !ticked(s)))
                      }
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
                <p className={styles.progressLine}>
                  Adding {progress} of {chosen.length}…
                </p>
                <div className={styles.bar} aria-hidden>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(progress / chosen.length) * 100}%` }}
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
                {totals?.added ? `, after adding ${series(totals.added)}` : ""}.
                Try again and anything already added will be skipped.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

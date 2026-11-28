// /editions: which volumes are in each omnibus, deluxe and VIZBIG book.
// Search a series (the price search's own box), or open one from the A to Z
// list. A series opened from the search (?series=) gets the lookup, "Which
// book has volume [23]?", answered in every edition at once, started at the
// reader's next volume when it's on their shelf, with each edition's books as
// tiles. The lines are the ones the series page shows (saved, by
// getEditionsIndex), so the two always agree. Search engines read the A to
// Z list as text (client/server.ts editionsIndexTags).
import { useEffect, useState } from "react";
import { NavLink, useSearchParams } from "react-router";
import SeriesPicture from "../../components/cover/SeriesPicture";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import {
  booksFromSpans,
  nextVolumeFor,
  lineFacts,
  type LookupLine,
} from "../../lib/editionLookup";
import { getEditionsIndex, type EditionsEntry } from "../../lib/editionsIndex";
import { EDITIONS_TITLE, editionsDescription } from "../../lib/editionsWords";
import { ownedOf } from "../../lib/ownedVolumes";
import {
  editionCanonicalPath,
  seriesCanonicalPath,
  slugify,
} from "../../lib/prices";
import { usePageMeta } from "../../lib/seo";
import { useShelf } from "../../store/shelf";
import BookTiles from "./BookTiles";
import ReportBook from "./ReportBook";
import EditionFinder from "./EditionFinder";
import { editionsStyles as styles } from "./editionsStyles";
import SeriesSearchBox from "./SeriesSearchBox";
import { pricesStyles } from "./styles";

const linesOf = (entry: EditionsEntry): LookupLine[] =>
  entry.lines.map((line) => ({
    key: line.key,
    label: line.label,
    books: booksFromSpans(line.spans),
  }));

// "7 books · 1 coming · vols. 1–24": the books shown, out or coming
function factsText(line: LookupLine) {
  const f = lineFacts(line);
  return `${f.books} books${f.coming ? ` · ${f.coming} coming` : ""} · vols. ${f.from}–${f.to}`;
}

// the letter a series files under, as /series files it
const letterOf = (name: string) => {
  const first =
    name
      .replace(/^the\s+/i, "")
      .trim()[0]
      ?.toUpperCase() ?? "#";
  return /[A-Z]/.test(first) ? first : "#";
};

export default function EditionsIndex() {
  const [params] = useSearchParams();
  const asked = params.get("series")?.trim() ?? "";
  const [state, setState] = useState<{
    entries: EditionsEntry[] | null;
    failed: boolean;
  }>({ entries: null, failed: false });
  useEffect(() => {
    const controller = new AbortController();
    getEditionsIndex(controller.signal)
      .then((entries) => setState({ entries, failed: false }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setState({ entries: [], failed: true });
      });
    return () => controller.abort();
  }, []);
  const entries = state.entries;
  const picked = asked
    ? (entries?.find((e) => e.slug === slugify(asked)) ?? null)
    : null;
  usePageMeta(
    asked
      ? {
          title: `${picked?.name ?? asked} editions: which volumes are in each book`,
          // the series page is the one search engines are given
          noindex: true,
          screen: "Editions",
        }
      : {
          title: EDITIONS_TITLE,
          description: editionsDescription(entries?.length ?? 0),
          path: "/editions",
          screen: "Editions",
        },
  );

  return (
    <div className={`${pricesStyles.page} fade-in`}>
      <header className={pricesStyles.indexHead}>
        <h1 className={pricesStyles.title}>Omnibus & deluxe editions</h1>
        <p className={pricesStyles.sub}>
          Which volumes are in each book. Search a series, or open one below.
        </p>
        <SeriesSearchBox
          // a picked series opens here, with its lookup
          goTo={(name) => `/editions?${new URLSearchParams({ series: name })}`}
          initialQuery=""
          autoFocus={false}
          placeholder="Search a series"
        />
      </header>

      {entries === null ? (
        <div aria-busy="true" aria-label="Loading">
          <SlowLoadQuote />
        </div>
      ) : asked ? (
        <Picked asked={asked} entry={picked} />
      ) : entries.length === 0 ? (
        <div
          className={pricesStyles.empty}
          role={state.failed ? "alert" : undefined}
        >
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={pricesStyles.emptyTitle}>
            {state.failed ? "The list didn't load." : "No editions yet."}
          </p>
          <p>
            {state.failed
              ? "Try again in a moment."
              : "A series' editions show here once its page has been opened."}
          </p>
        </div>
      ) : (
        <AtoZ entries={entries} />
      )}
    </div>
  );
}

// the reader's own volumes of a series, when it's on their shelf
function useOwned(name: string) {
  const shelf = useShelf((s) => s.manga);
  const mine = shelf?.find((m) => slugify(m.name) === slugify(name));
  return mine ? ownedOf(mine) : [];
}

// one series, opened from the search: the lookup, then each edition's books
function Picked({
  asked,
  entry,
}: {
  asked: string;
  entry: EditionsEntry | null;
}) {
  const owned = useOwned(entry?.name ?? asked);
  const lines = entry ? linesOf(entry) : [];
  const startAt = nextVolumeFor(lines, owned);
  if (!entry)
    return (
      <div className={pricesStyles.empty}>
        <p className={pricesStyles.emptyTitle}>
          No omnibus or deluxe editions known for {asked} yet.
        </p>
        <p>Its series page looks for them; once found they show here too.</p>
        <NavLink
          to={seriesCanonicalPath(asked)}
          className="btn btn-secondary"
          viewTransition
        >
          Open {asked}
        </NavLink>
      </div>
    );
  return (
    <section
      className="flex flex-col gap-6"
      aria-label={`${entry.name} editions`}
    >
      <h2 className={styles.pickedName}>{entry.name}</h2>
      {/* drawn again once their shelf is in: it starts at their next one */}
      <PickedLines
        key={`${entry.slug}:${startAt ?? ""}`}
        entry={entry}
        lines={lines}
        owned={owned}
        startAt={startAt}
      />
      <p className="text-[0.9rem]">
        <NavLink to="/editions" className={styles.textLink} viewTransition>
          Every series with editions
        </NavLink>
      </p>
    </section>
  );
}

// the lookup, and each edition's books with the answered one framed
function PickedLines({
  entry,
  lines,
  owned,
  startAt,
}: {
  entry: EditionsEntry;
  lines: LookupLine[];
  owned: number[];
  startAt: number | null;
}) {
  const [volume, setVolume] = useState<number | null>(startAt);
  return (
    <>
      {/* the series' cover beside the lookup, under its name */}
      <div className={styles.pickedHead}>
        <span className={styles.pickedCover} aria-hidden>
          <SeriesPicture name={entry.name} url={entry.coverUrl} sizes="96px" />
        </span>
        <div className="min-w-0 flex-1">
          <EditionFinder lines={lines} startAt={startAt} onVolume={setVolume} />
        </div>
      </div>
      <div className={styles.pickedLines}>
        {lines.map((line) => (
          <div key={line.key} className={styles.lineBlock}>
            <div className={styles.lineHead}>
              <span className={styles.lineName}>{line.label}</span>
              <span className={styles.lineFacts}>{factsText(line)}</span>
            </div>
            <BookTiles line={line} volume={volume} owned={owned} />
            <p className="mt-3 text-[0.9rem] font-medium">
              <NavLink
                to={editionCanonicalPath(entry.name, line.key)}
                className={styles.textLink}
                viewTransition
              >
                {line.label} prices →
              </NavLink>
            </p>
          </div>
        ))}
      </div>
      {/* a block of its own: the form's style is made for a grid's foot */}
      <div>
        <ReportBook seriesName={entry.name} lines={lines} />
      </div>
    </>
  );
}

// every series with editions, A to Z, folded: one opens to its books
function AtoZ({ entries }: { entries: EditionsEntry[] }) {
  const sorted = [...entries].sort((a, b) =>
    a.name
      .replace(/^the\s+/i, "")
      .localeCompare(b.name.replace(/^the\s+/i, "")),
  );
  const groups: [string, EditionsEntry[]][] = [];
  for (const entry of sorted) {
    const letter = letterOf(entry.name);
    const last = groups.at(-1);
    if (last?.[0] === letter) last[1].push(entry);
    else groups.push([letter, [entry]]);
  }
  return (
    <div className={styles.list}>
      {groups.map(([letter, list]) => (
        <section key={letter} aria-label={letter}>
          <h2 className={styles.letter}>{letter}</h2>
          {list.map((entry) => (
            <SeriesFold key={entry.slug} entry={entry} />
          ))}
        </section>
      ))}
    </div>
  );
}

function SeriesFold({ entry }: { entry: EditionsEntry }) {
  const owned = useOwned(entry.name);
  const lines = linesOf(entry);
  return (
    <details className={styles.series}>
      <summary className={styles.seriesSummary}>
        <span className={styles.cover} aria-hidden>
          <SeriesPicture name={entry.name} url={entry.coverUrl} sizes="44px" />
        </span>
        <span className={styles.seriesName}>{entry.name}</span>
        <span className={styles.seriesLines}>
          {lines.map((line) => (
            <span key={line.key} className="block">
              {line.label} · {lineFacts(line).books}
            </span>
          ))}
        </span>
      </summary>
      <div className={styles.seriesBody}>
        {lines.map((line) => (
          <div key={line.key} className={styles.lineBlock}>
            <div className={styles.lineHead}>
              <span className={styles.lineName}>{line.label}</span>
              <span className={styles.lineFacts}>{factsText(line)}</span>
            </div>
            <BookTiles line={line} owned={owned} />
          </div>
        ))}
        <p className={styles.seriesLinks}>
          <NavLink
            to={`/editions?${new URLSearchParams({ series: entry.name })}`}
            className={styles.textLink}
            viewTransition
          >
            Which book has my volume?
          </NavLink>
          <NavLink
            to={seriesCanonicalPath(entry.name)}
            className={styles.textLink}
            viewTransition
          >
            Prices
          </NavLink>
        </p>
      </div>
    </details>
  );
}

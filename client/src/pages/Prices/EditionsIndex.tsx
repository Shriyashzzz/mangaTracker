// /editions: every series with an omnibus or deluxe line, and which volumes
// are in each book. A line is drawn as its books on a shelf, each as wide as
// the volumes it holds, so "VIZBIG 3 is vols. 7–9" reads at a glance; it
// opens the series' page on that line, with every book and its price.
// Search engines get the same as text from the site server (server.ts
// editionsIndexTags).
import { useEffect, useState, type CSSProperties } from "react";
import { NavLink } from "react-router";
import SeriesPicture from "../../components/cover/SeriesPicture";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { getEditionsIndex, type EditionsEntry } from "../../lib/editionsIndex";
import { EDITIONS_TITLE, editionsDescription } from "../../lib/editionsWords";
import { seriesCanonicalPath } from "../../lib/prices";
import { usePageMeta } from "../../lib/seo";
import { editionsIndexStyles as e } from "./editionsIndexStyles";
import { pricesStyles as styles } from "./styles";

// a line of more books than this: its spines too thin for their numbers
const NUMBERED_UP_TO = 16;

export default function EditionsIndex() {
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
  usePageMeta({
    title: EDITIONS_TITLE,
    description: editionsDescription(entries?.length ?? 0),
    path: "/editions",
    screen: "Editions",
  });

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={styles.indexHead}>
        <h1 className={styles.title}>Omnibus & deluxe editions</h1>
        <p className={styles.sub}>
          Which volumes are in each book, series by series. Open one for every
          book and its price.
        </p>
      </header>

      {entries === null ? (
        <div aria-busy="true" aria-label="Loading">
          <SlowLoadQuote />
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.empty} role={state.failed ? "alert" : undefined}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={styles.emptyTitle}>
            {state.failed ? "The list didn't load." : "No editions yet."}
          </p>
          <p>
            {state.failed
              ? "Try again in a moment."
              : "A series' editions show here once its page has been opened."}
          </p>
          <NavLink to="/series" className="btn btn-secondary" viewTransition>
            All series
          </NavLink>
        </div>
      ) : (
        <ul className={e.list}>
          {entries.map((series) => (
            <EditionsRow key={series.slug} series={series} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EditionsRow({ series }: { series: EditionsEntry }) {
  const page = seriesCanonicalPath(series.name);
  return (
    <li className={e.series}>
      <NavLink
        to={page}
        className={e.cover}
        aria-hidden
        tabIndex={-1}
        viewTransition
      >
        <SeriesPicture name={series.name} url={series.coverUrl} sizes="56px" />
      </NavLink>
      <div className={e.body}>
        <h2>
          <NavLink to={page} className={e.name} viewTransition>
            {series.name}
          </NavLink>
        </h2>
        {series.lines.map((line) => (
          <NavLink
            key={line.key}
            to={`${page}?edition=${encodeURIComponent(line.key)}`}
            className={e.line}
            aria-label={`${series.name} ${line.label}: ${line.books} books, vols. ${line.from} to ${line.to}`}
            viewTransition
          >
            <span className={e.lineHead}>
              <span className={e.lineName}>{line.label}</span>
              <span className={e.lineFacts}>
                {line.books} books · vols. {line.from}–{line.to}
              </span>
            </span>
            <span
              className={e.shelf}
              aria-hidden
              style={
                {
                  gridTemplateColumns: `repeat(${line.to - line.from + 1}, minmax(0, 1fr))`,
                } as CSSProperties
              }
            >
              {line.spans.map((book) => (
                <i
                  key={book.number}
                  className={e.book}
                  style={{
                    gridColumn: `${book.from - line.from + 1} / span ${book.to - book.from + 1}`,
                    fontStyle: "normal",
                  }}
                >
                  {line.spans.length <= NUMBERED_UP_TO && book.number}
                </i>
              ))}
            </span>
          </NavLink>
        ))}
      </div>
    </li>
  );
}

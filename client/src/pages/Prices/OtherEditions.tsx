// A series' other editions, on its price page's Editions tab: "Which book
// has volume…?" for the edition picked, its books as covers like the
// volumes (each with the volumes inside and its last known price), then what
// the whole run costs in them and in singles. One with an ISBN opens its own
// price page; one the catalog doesn't list is still shown, so the run has no
// holes.
import { inApp } from "../../lib/inApp";
import VolumeCard from "./VolumeCard";
import { useEffect, useState } from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { getJson } from "../../lib/api";
import {
  editionBookLabel,
  lineFor,
  type EditionLine,
} from "../../lib/editions";
import { formatCents, wholeMoney } from "../../lib/prices";
import { lineCost, runTotal, type SeriesCost } from "../../lib/finishCost";
import { nextVolumeFor } from "../../lib/editionLookup";
import EditionFinder from "./EditionFinder";
import { pricesStyles as styles } from "./styles";

type Props = {
  // the series as the price pages name it
  name: string;
  // the edition shown, from the address (?edition=deluxe): a search and the
  // edition buttons here both set it, so they never disagree
  asked: string | null;
  // the volumes they own, when the series is on their shelf
  owned: number[];
  // the series' lines, once they're known: the page's heading shows one
  onLines: (lines: EditionLine[]) => void;
  // what all its singles out now cost new, beside what a line's books do
  singles: SeriesCost | null;
  // the series' own cover, for a book with no cover of its own
  seriesCoverUrl?: string | null;
};

export default function OtherEditions({
  name,
  asked,
  owned,
  onLines,
  singles,
  seriesCoverUrl = null,
}: Props) {
  const [state, setState] = useState<{ name: string; lines: EditionLine[] }>({
    name: "",
    lines: [],
  });
  const [, setParams] = useSearchParams();
  // on an edition's own page another edition is its own page too; on the
  // series page it's ?edition=, so the page stays the series'
  const { slug, edition: pathEdition } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const showEdition = (key: string) => {
    if (pathEdition) {
      navigate(`/prices/series/${slug}/${encodeURIComponent(key)}${search}`, {
        replace: true,
        preventScrollReset: true,
      });
      return;
    }
    setParams(
      (now) => {
        const next = new URLSearchParams(now);
        next.set("edition", key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    getJson<{ lines: EditionLine[] }>(
      `/api/prices/editions?${new URLSearchParams({ name })}`,
      controller.signal,
    )
      .then(({ lines }) => {
        setState({ name, lines: lines ?? [] });
        onLines(lines ?? []);
      })
      .catch(() => onLines([]));
    return () => controller.abort();
    // onLines is the page's own setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const lines = state.name === name ? state.lines : [];
  const wanted = lineFor(lines, asked);
  if (!lines.length) return null;
  const line = wanted ?? lines[0]!;
  const mine = new Set(owned);
  const inside = line.books.flatMap((b) => b.volumes);
  const app = inApp();
  const piled = /omnibus|in-1/i.test(line.label);

  return (
    <section className={styles.editions} aria-labelledby="editions-title">
      <div className={`${styles.sectionHeadRow} ${app ? "" : "justify-end!"}`}>
        {/* on the website the Editions tab above names it */}
        <h2
          id="editions-title"
          className={app ? styles.sectionTitle : "sr-only"}
        >
          Other editions
        </h2>
        <span className={styles.checked}>
          {line.books.length} {line.label} books hold vols.{" "}
          {Math.min(...inside)}–{Math.max(...inside)}
        </span>
      </div>
      {/* which of the picked edition's books holds a volume: the same lookup
          as /editions, started at their next volume of that edition when
          it's theirs */}
      <div className="mb-5">
        <EditionFinder
          key={`${name}:${line.key}:${nextVolumeFor([line], owned) ?? ""}`}
          lines={[line]}
          startAt={nextVolumeFor([line], owned)}
        />
      </div>
      {lines.length > 1 && (
        <div className={styles.editionTabs} role="group" aria-label="Edition">
          {lines.map((l) => (
            <button
              key={l.key}
              type="button"
              className={styles.editionTab}
              aria-pressed={l.key === line.key}
              onClick={() => showEdition(l.key)}
            >
              {l.label}
              <span className={styles.editionTabCount}>{l.books.length}</span>
            </button>
          ))}
        </div>
      )}
      {/* the books as covers, like the volumes on the other tab (in the
          app four to a row, index.css .app-cover-grid), every one */}
      <ul className={`${styles.grid} app-cover-grid edition-cover-grid`}>
        {line.books.map((book) => {
          const have = book.volumes.filter((v) => mine.has(v)).length;
          const label = editionBookLabel(line, book);
          const first = Math.min(...book.volumes);
          const last = Math.max(...book.volumes);
          return (
            // its look (index.css): a plain omnibus ("Omnibus 3", "3-in-1")
            // a small neat pile; a named edition (VIZBIG, Definitive,
            // Deluxe) is one big book, one flat cover
            <li key={book.number} data-pile={piled || undefined}>
              <VolumeCard
                isbn13={book.isbn13}
                title={label}
                fullTitle={book.title ?? label}
                // one volume inside: "Vol. 5" on it, else "Vols. 1–3"
                volume={first === last ? first : null}
                bookNumber={book.number}
                holds={first === last ? undefined : { from: first, to: last }}
                coverUrl={
                  book.isbn13 ? `/api/prices/cover/${book.isbn13}` : null
                }
                seriesCoverUrl={seriesCoverUrl}
                seriesName={name}
                priceCents={book.knownPriceCents ?? null}
                mark={have === book.volumes.length ? "yours" : undefined}
                subtitle={
                  !book.isbn13 && book.knownPriceCents == null
                    ? "not listed yet"
                    : have > 0 && have < book.volumes.length
                      ? `you have ${have} of ${book.volumes.length}`
                      : undefined
                }
                plainStandIn
              />
            </li>
          );
        })}
      </ul>
      <NavLink to="/editions" className={styles.editionsMore} viewTransition>
        Every series with other editions →
      </NavLink>
      <RunCosts line={line} singles={singles} />
    </section>
  );
}

// the whole run new, this line's books and the singles, one a line, each
// said once any of it is priced (lib/finishCost.ts runTotal): the question a
// collector weighing the two asks
function RunCosts({
  line,
  singles,
}: {
  line: EditionLine;
  singles: SeriesCost | null;
}) {
  const books = runTotal(lineCost(line.books));
  const loose = runTotal(singles);
  if (!books) return null;
  const said = (run: { cents: number; exact: boolean }) =>
    run.exact ? formatCents(run.cents) : `about ${wholeMoney(run.cents)}`;
  return (
    <ul className={styles.editionCosts}>
      <li>
        All {line.books.length} {line.label} books:{" "}
        <strong>{said(books)}</strong> new
      </li>
      {loose && singles && (
        <li>
          All {singles.volumes} singles: <strong>{said(loose)}</strong> new
        </li>
      )}
    </ul>
  );
}

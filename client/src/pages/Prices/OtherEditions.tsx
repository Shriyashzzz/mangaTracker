// A series' other editions on its price page: the deluxe, omnibus or 3-in-1
// books, each with the volumes inside and its last known price. One with an
// ISBN opens its own price page; one the catalog doesn't list is still named,
// so the run has no holes.
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { getJson } from "../../lib/api";
import {
  editionBookLabel,
  insideText,
  lineFor,
  type EditionLine,
} from "../../lib/editions";
import { formatCents, volumePath } from "../../lib/prices";
import RangePager from "../../components/rangePager/RangePager";
import { pricesStyles as styles } from "./styles";

type Props = {
  // the series as the price pages name it
  name: string;
  // the edition the address asks for (?edition=deluxe), from a search
  asked: string | null;
  // the volumes they own, when the series is on their shelf
  owned: number[];
  // whether the series has any, once that's known
  onFound: (found: boolean) => void;
};

// a page of books: four rows of three on a laptop
const PAGE_SIZE = 12;

export default function OtherEditions({ name, asked, owned, onFound }: Props) {
  const [state, setState] = useState<{ name: string; lines: EditionLine[] }>({
    name: "",
    lines: [],
  });
  // the edition they tapped and the page of it they're on, for this series
  // only
  const [picked, setPicked] = useState<{
    name: string;
    key: string;
    page: number;
  } | null>(null);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson<{ lines: EditionLine[] }>(
      `/api/prices/editions?${new URLSearchParams({ name })}`,
      controller.signal,
    )
      .then(({ lines }) => {
        setState({ name, lines: lines ?? [] });
        onFound(Boolean(lines?.length));
      })
      .catch(() => onFound(false));
    return () => controller.abort();
    // onFound is the page's own setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const lines = state.name === name ? state.lines : [];
  const wanted = lineFor(lines, asked);
  // asked for by name: brought into view once it's there
  const wantedKey = wanted?.key;
  useEffect(() => {
    if (wantedKey) section.current?.scrollIntoView({ block: "start" });
  }, [wantedKey]);

  if (!lines.length) return null;
  const line =
    lines.find((l) => picked?.name === name && l.key === picked.key) ??
    wanted ??
    lines[0]!;
  const mine = new Set(owned);
  const page =
    picked?.name === name && picked.key === line.key ? picked.page : 0;
  const shown = line.books.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const inside = line.books.flatMap((b) => b.volumes);

  return (
    <section
      ref={section}
      className={styles.editions}
      aria-labelledby="editions-title"
    >
      <div className={styles.sectionHeadRow}>
        <h2 id="editions-title" className={styles.sectionTitle}>
          Other editions
        </h2>
        <span className={styles.checked}>
          {line.books.length} {line.label} books hold vols.{" "}
          {Math.min(...inside)}–{Math.max(...inside)} · Prices load when you
          open one
        </span>
      </div>
      {lines.length > 1 && (
        <div className={styles.editionTabs} role="group" aria-label="Edition">
          {lines.map((l) => (
            <button
              key={l.key}
              type="button"
              className={styles.editionTab}
              aria-pressed={l.key === line.key}
              onClick={() => setPicked({ name, key: l.key, page: 0 })}
            >
              {l.label}
              <span className={styles.editionTabCount}>{l.books.length}</span>
            </button>
          ))}
        </div>
      )}
      <ul className={styles.editionList}>
        {shown.map((book) => {
          const have = book.volumes.filter((v) => mine.has(v)).length;
          const label = editionBookLabel(line, book);
          return (
            <li key={book.number} className={styles.editionRow}>
              <span className={styles.editionName}>{label}</span>
              <span className={styles.editionInside}>
                {insideText(book)}
                {have > 0 &&
                  (have === book.volumes.length
                    ? " · on your shelf"
                    : ` · you have ${have} of ${book.volumes.length}`)}
              </span>
              {book.isbn13 ? (
                <NavLink
                  to={volumePath(book.isbn13, book.title ?? label)}
                  className={styles.editionPrice}
                  viewTransition
                >
                  {book.knownPriceCents != null
                    ? formatCents(book.knownPriceCents)
                    : "check price"}{" "}
                  →
                </NavLink>
              ) : (
                <span className={styles.editionUnlisted}>not listed yet</span>
              )}
            </li>
          );
        })}
      </ul>
      {line.books.length > PAGE_SIZE && (
        <RangePager
          total={line.books.length}
          pageSize={PAGE_SIZE}
          page={page}
          onChange={(index) => {
            setPicked({ name, key: line.key, page: index });
            section.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
          label={`${line.label} books`}
          // by the books each page holds: "13–24"
          labelFor={(start, end) =>
            `${line.books[start]?.number}–${line.books[end]?.number}`
          }
        />
      )}
    </section>
  );
}

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { SeriesHit } from "../../lib/types";
import { useNavigate } from "react-router";
import { SearchIcon } from "../../components/icons/Icons";
import { asIsbn, searchSeries, seriesPath } from "../../lib/prices";
import { pricesStyles as styles } from "./styles";

const SHOWN = 5;
const DEBOUNCE_MS = 250;

// search box with a dropdown of matching series. Picking one opens its
// series page; the last row ("See all") opens the full results. A pasted
// ISBN skips straight to that volume
type Props = { initialQuery?: string; autoFocus?: boolean };

export default function SeriesSearchBox({ initialQuery = "", autoFocus }: Props) {
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // suggestions are kept with the text they answer, so a slow reply for an
  // older word never replaces a newer one
  const [found, setFound] = useState<{
    q: string;
    items: SeriesHit[];
    loading: boolean;
  }>({ q: "", items: [], loading: false });

  // keep the box in step with the URL (back/forward, quick picks)
  const [shownInitial, setShownInitial] = useState(initialQuery);
  if (shownInitial !== initialQuery) {
    setShownInitial(initialQuery);
    setText(initialQuery);
  }

  const q = text.trim();
  const isbn = asIsbn(q);
  const wantsSuggestions = open && q.length >= 2 && !isbn;

  useEffect(() => {
    if (!wantsSuggestions) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setFound((f) => ({ ...f, loading: true }));
      searchSeries(q, controller.signal)
        .then((items) => setFound({ q, items, loading: false }))
        .catch((e) => {
          if (e.name !== "AbortError") {
            setFound({ q, items: [], loading: false });
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, wantsSuggestions]);

  // close when clicking anywhere else
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const fresh = found.q === q;
  const shown = fresh ? found.items.slice(0, SHOWN) : [];
  // the rows you can move through: each series, then "See all"
  const rowCount = shown.length + 1;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const seeAll = () => {
    close();
    if (isbn) navigate(`/prices/${isbn}`, { viewTransition: true });
    else if (q.length >= 2)
      navigate(`/?${new URLSearchParams({ q })}`, {
        viewTransition: true,
      });
  };
  const pick = (series: SeriesHit) => {
    close();
    navigate(seriesPath(series.name), { viewTransition: true });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (!wantsSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % rowCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? rowCount - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0 && active < shown.length) {
      e.preventDefault();
      pick(shown[active]);
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <form
      ref={rootRef}
      className={styles.searchForm}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        seeAll();
      }}
    >
      <div className={styles.comboWrap}>
        <label className={styles.searchBox}>
          <SearchIcon />
          <span className="sr-only">Series name or ISBN</span>
          <input
            type="search"
            role="combobox"
            aria-expanded={wantsSuggestions}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              wantsSuggestions && active >= 0 ? optionId(active) : undefined
            }
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search a series, or paste an ISBN"
            maxLength={100}
            autoComplete="off"
            autoFocus={autoFocus}
          />
        </label>

        {wantsSuggestions && (
          <ul id={listId} role="listbox" className={styles.suggestions}>
            {!fresh && (
              <li className={styles.suggestNote} aria-live="polite">
                Looking…
              </li>
            )}
            {fresh && shown.length === 0 && (
              <li className={styles.suggestNote} aria-live="polite">
                No English series match “{q}”
              </li>
            )}
            {shown.map((s, i) => (
              <li
                key={s.slug}
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                className={`${styles.suggestion} ${active === i ? styles.suggestActive : ""}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.suggestThumb}>
                  {s.thumbUrl && <img src={s.thumbUrl} alt="" />}
                </span>
                <span className={styles.suggestText}>
                  <span className={styles.suggestName}>{s.name}</span>
                  <span className={styles.suggestMeta}>
                    {[
                      s.year,
                      s.volumes && `${s.volumes} volumes`,
                      s.score && `Score ${s.score}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
            <li
              id={optionId(shown.length)}
              role="option"
              aria-selected={active === shown.length}
              className={`${styles.seeAll} ${active === shown.length ? styles.suggestActive : ""}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={seeAll}
              onMouseEnter={() => setActive(shown.length)}
            >
              See all results for “{q}”
            </li>
          </ul>
        )}
      </div>
      <button type="submit" className="btn btn-primary btn-lg">
        Search
      </button>
    </form>
  );
}

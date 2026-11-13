import { askedEdition } from "../../lib/editions";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SeriesHit } from "../../lib/types";
import { useNavigate } from "react-router";
import { SearchIcon } from "../../components/icons/Icons";
import {
  asIsbn,
  coverSrc,
  hideBrokenCover,
  hidePlaceholderCover,
  novelParts,
  searchSeries,
  seriesPath,
} from "../../lib/prices";
import { pricesStyles as styles } from "./styles";
import { isMobile } from "react-device-detect";
import { hasBottomBar } from "../../lib/bottomBar";

const SHOWN = 5;
const DEBOUNCE_MS = 250;

// search box with a dropdown of matching series. Picking one opens its
// series page; the last row ("See all") opens the full results. A pasted
// ISBN skips straight to that volume
type Props = {
  initialQuery?: string;
  autoFocus: boolean;
  // where a picked series goes, when it isn't its price page (the "after
  // the anime" search). With it there's no page of all results: Search
  // opens the first match
  goTo?: (seriesName: string) => string;
  placeholder?: string;
};

export default function SeriesSearchBox({
  initialQuery = "",
  autoFocus = false,
  goTo,
  placeholder,
}: Props) {
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
  // an ISBN goes to its volume's prices; the other search has no use for one
  const wantsSuggestions = open && q.length >= 2 && (!isbn || Boolean(goTo));

  useEffect(() => {
    if (!wantsSuggestions) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setFound((f) => ({ ...f, loading: true }));
      // "berserk deluxe": the series is searched, the edition kept for its page
      searchSeries(askedEdition(q).series, controller.signal)
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
  // the rows you can move through: each series, then "See all" (when
  // there's a page of all results)
  const rowCount = shown.length + (goTo ? 0 : 1);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const seeAll = () => {
    if (goTo) {
      // no results page of its own: the first match, once there is one
      if (shown[0]) pick(shown[0]);
      return;
    }
    close();
    if (isbn) navigate(`/prices/${isbn}`, { viewTransition: true });
    else if (q.length >= 2)
      navigate(`/?${new URLSearchParams({ q: askedEdition(q).series })}`, {
        viewTransition: true,
      });
  };
  const pick = (series: SeriesHit) => {
    close();
    if (goTo) {
      navigate(goTo(series.name), { viewTransition: true });
      return;
    }
    // straight to the edition they named, when they named one
    const { edition } = askedEdition(q);
    navigate(seriesPath(series.name) + (edition ? `&edition=${edition}` : ""), {
      viewTransition: true,
    });
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
  // a narrow box cuts the long one off mid-word
  const ownPlaceholder =
    isMobile || hasBottomBar()
      ? "Title or ISBN"
      : "Search a series, or paste an ISBN";

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
          <span className="sr-only">
            {goTo ? "Anime or manga name" : "Series name or ISBN"}
          </span>
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
            placeholder={placeholder ?? ownPlaceholder}
            maxLength={100}
            autoComplete="off"
            autoFocus={isMobile || hasBottomBar() ? false : autoFocus}
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
                  {s.thumbUrl && (
                    <img
                      src={coverSrc(s.thumbUrl)}
                      alt=""
                      onError={hideBrokenCover}
                      onLoad={hidePlaceholderCover}
                    />
                  )}
                </span>
                <span className={styles.suggestText}>
                  <span className={styles.suggestName}>
                    {novelParts(s.name).title}
                  </span>
                  <span className={styles.suggestMeta}>
                    {[
                      s.lightNovel && "Light novel",
                      s.year,
                      s.volumes &&
                        `${s.volumes} volume${s.volumes === 1 ? "" : "s"}`,
                      s.score && `AniList ${s.score}%`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
            {!goTo && (
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
            )}
          </ul>
        )}
      </div>
      <button type="submit" className="btn btn-primary btn-lg">
        Search
      </button>
    </form>
  );
}

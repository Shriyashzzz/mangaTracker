import { askedEdition } from "../../lib/editions";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SeriesHit } from "../../lib/types";
import { useNavigate } from "react-router";
import SeriesPicture from "../../components/cover/SeriesPicture";
import { ChevronLeftIcon, SearchIcon } from "../../components/icons/Icons";
import { asIsbn, findSeries, novelParts, seriesPath } from "../../lib/prices";
import { DID_YOU_MEAN } from "../../lib/nearMatches";
import { starsOf } from "./reviews/reviewText";
import { pricesStyles as styles } from "./styles";
import { isMobile } from "react-device-detect";
import { hasBottomBar } from "../../lib/bottomBar";
import { keepFocus, onMouseHover } from "../../lib/keepFocus";
import { inApp } from "../../lib/inApp";
import { useCloseOnBack } from "../../lib/closeOnBack";
import { recentSearches, rememberSearch } from "../../lib/recentSearches";

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
  // in the app, searching takes the whole screen, as Android's search does:
  // a back arrow, the results below, the last picks while the box is empty
  const [full, setFull] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(-1);
  // suggestions are kept with the text they answer, so a slow reply for an
  // older word never replaces a newer one
  const [found, setFound] = useState<{
    q: string;
    items: SeriesHit[];
    // found by one of its words: a typo's guesses
    guessed?: boolean;
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
      findSeries(askedEdition(q).series, controller.signal)
        .then(({ hits, guessed }) =>
          setFound({ q, items: hits, guessed, loading: false }),
        )
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
    setFull(false);
  };
  // the back arrow, Android's Back or Escape: the page as it was
  const leaveFull = () => {
    close();
    inputRef.current?.blur();
  };
  useCloseOnBack(full, leaveFull);
  const recent = full && q.length < 2 ? recentSearches() : [];
  const seeAll = () => {
    if (goTo) {
      // no results page of its own: the first match, once there is one
      if (shown[0]) pick(shown[0]);
      return;
    }
    close();
    if (isbn) navigate(`/prices/${isbn}`, { viewTransition: true });
    else if (q.length >= 2) {
      // "berserk deluxe": the results are Berserk's, and each opens on its
      // Deluxe books (PriceSearch)
      const { series, edition } = askedEdition(q);
      navigate(
        `/?${new URLSearchParams({ q: series, ...(edition ? { edition } : {}) })}`,
        { viewTransition: true },
      );
    }
  };
  const pick = (series: Pick<SeriesHit, "name">) => {
    close();
    rememberSearch(series.name);
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
      data-full={full || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        seeAll();
      }}
    >
      <div className={styles.comboWrap}>
        {full && (
          <button
            type="button"
            className="app-search-back"
            aria-label="Close search"
            {...keepFocus}
            onClick={leaveFull}
          >
            <ChevronLeftIcon className="size-6" aria-hidden />
          </button>
        )}
        <label className={styles.searchBox}>
          <SearchIcon />
          <span className="sr-only">
            {goTo ? "Anime or manga name" : "Series name or ISBN"}
          </span>
          <input
            ref={inputRef}
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
            onFocus={() => {
              setOpen(true);
              if (inApp()) setFull(true);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? ownPlaceholder}
            maxLength={100}
            autoComplete="off"
            autoFocus={isMobile || hasBottomBar() ? false : autoFocus}
          />
        </label>

        {recent.length > 0 && (
          <ul className={styles.suggestions} aria-label="Recent searches">
            {recent.map((name) => (
              <li
                key={name}
                className={styles.suggestion}
                {...keepFocus}
                onClick={() => pick({ name })}
              >
                <span className="app-recent-mark" aria-hidden>
                  ↺
                </span>
                <span className={styles.suggestName}>
                  {novelParts(name).title}
                </span>
              </li>
            ))}
          </ul>
        )}
        {wantsSuggestions && (
          <ul id={listId} role="listbox" className={styles.suggestions}>
            {!fresh && (
              <li className={styles.suggestNote} aria-live="polite">
                Looking…
              </li>
            )}
            {fresh && shown.length === 0 && (
              <li className={styles.suggestNote} aria-live="polite">
                No English series by that name. Check the spelling.
              </li>
            )}
            {fresh && found.guessed && shown.length > 0 && (
              <li className={styles.suggestNote} aria-live="polite">
                {DID_YOU_MEAN}
              </li>
            )}
            {shown.map((s, i) => (
              <li
                key={s.slug}
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                className={`${styles.suggestion} ${active === i ? styles.suggestActive : ""}`}
                {...keepFocus}
                onClick={() => pick(s)}
                {...onMouseHover(() => setActive(i))}
              >
                <span className={styles.suggestThumb}>
                  <SeriesPicture name={s.name} url={s.thumbUrl} sizes="34px" />
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
                      s.score && `★ ${starsOf(s.score)}`,
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
                {...keepFocus}
                onClick={seeAll}
                {...onMouseHover(() => setActive(shown.length))}
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

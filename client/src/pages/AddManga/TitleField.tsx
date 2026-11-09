import { useId, useState, type KeyboardEvent } from "react";
import { pricesStyles as list } from "../Prices/styles";
import { formStyles as styles } from "../../styles/form";
import type { CoverHit } from "../../lib/anilist";
import { hasBottomBar } from "../../lib/bottomBar";
import { SearchIcon } from "../../components/icons/Icons";
import {
  MIN_QUERY,
  type SearchStatus,
} from "../../components/coverPicker/useCoverSearch";

type Props = {
  value: string;
  // what's wrong with it, said under the field
  error?: string;
  onChange: (title: string) => void;
  // what AniList thinks they might mean, for this title, and how the
  // lookup is going
  hits: CoverHit[];
  status: SearchStatus;
  onPick: (hit: CoverHit) => void;
  // none of these: the title as they typed it
  onTyped: () => void;
  // the add page: the box takes the cursor on arrival, on phones too
  isAddPage: boolean;
};

// The add page's title box: AniList's closest guesses drop down as they
// type, with their covers. Picking one uses AniList's name, cover, type and
// genre; "as typed" keeps what they wrote, since it may be a manga AniList
// doesn't know. Enter with nothing highlighted means as typed too
export default function TitleField({
  value,
  error,
  onChange,
  hits,
  status,
  onPick,
  onTyped,
  isAddPage,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const typed = value.trim();
  const showing = open && typed.length >= MIN_QUERY;

  const pick = (hit: CoverHit) => {
    setOpen(false);
    setActive(-1);
    onPick(hit);
  };

  // the highlighted option, kept in view as the arrows move through the list
  const highlight = (i: number) => {
    setActive(i);
    document
      .getElementById(`${listId}-${i}`)
      ?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // a Japanese (or any composing) keyboard's Enter confirms a word, not
    // the title
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter") {
      // never the form's submit: the rest of the form isn't there yet
      e.preventDefault();
      if (showing && active >= 0) pick(hits[active]!);
      else if (typed) onTyped();
    } else if (!open && e.key === "ArrowDown") {
      // closed with Escape: the arrow opens it again
      e.preventDefault();
      setOpen(true);
    } else if (showing && hits.length && e.key === "ArrowDown") {
      e.preventDefault();
      highlight((active + 1) % hits.length);
    } else if (showing && hits.length && e.key === "ArrowUp") {
      e.preventDefault();
      highlight(active <= 0 ? hits.length - 1 : active - 1);
    }
  };

  return (
    <div className={styles.titleCombo}>
      <SearchIcon className={styles.titleSearchIcon} aria-hidden />
      <input
        className={`${styles.input} ${styles.titleSearch} ${error ? styles.invalid : ""}`}
        id="name"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? "name-error" : undefined}
        name="name"
        type="text"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showing && active >= 0 ? `${listId}-${active}` : undefined
        }
        placeholder="Search a title, e.g. Berserk"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={(e) => {
          setOpen(true);
          // phones: up to the top, so the keyboard leaves room for the list
          if (hasBottomBar())
            e.currentTarget.scrollIntoView({ block: "start" });
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        maxLength={150}
        autoComplete="off"
        enterKeyHint="next"
        autoFocus={isAddPage}
      />

      {showing && (
        // keeps focus in the box, so a click lands before it closes
        <div
          className={styles.titleList}
          onPointerDown={(e) => e.preventDefault()}
        >
          <ul id={listId} role="listbox" aria-label="Matches from AniList">
            {hits.map((hit, i) => (
              <li
                key={hit.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={active === i}
                className={`${list.suggestion} ${styles.titleOption} ${active === i ? list.suggestActive : ""}`}
                onClick={() => pick(hit)}
                onMouseEnter={() => setActive(i)}
              >
                <span className={list.suggestThumb}>
                  <img src={hit.cover} alt="" loading="lazy" />
                </span>
                <span className={list.suggestText}>
                  <span className={list.suggestName}>{hit.title}</span>
                  {(hit.year || hit.lightNovel) && (
                    <span className={list.suggestMeta}>
                      {hit.year}
                      {hit.lightNovel && (
                        <span className={styles.titleTag}>Light novel</span>
                      )}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {!hits.length && (
            <p className={list.suggestNote} aria-live="polite">
              {status === "error"
                ? "Couldn't reach AniList right now."
                : status === "done"
                  ? "AniList doesn't know that one."
                  : "Looking it up…"}
            </p>
          )}
          <div className={styles.titleListFoot}>
            {hits.length > 0 && (
              <span className={styles.counter}>{hits.length} from AniList</span>
            )}
            <button
              type="button"
              className={styles.titleTyped}
              onClick={onTyped}
            >
              Add “{typed}” as typed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

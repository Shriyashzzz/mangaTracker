import { useId, useState, type KeyboardEvent } from "react";
import { pricesStyles as list } from "../Prices/styles";
import { formStyles as styles } from "../../styles/form";
import type { CoverHit } from "../../lib/anilist";
import { hasBottomBar } from "../../lib/bottomBar";

const SHOWN = 5;

type Props = {
  value: string;
  onChange: (title: string) => void;
  // what AniList thinks they might mean, for this title
  hits: CoverHit[];
  onPick: (hit: CoverHit) => void;
};

// The title box: AniList's closest guesses drop down as they type. Picking one
// uses AniList's name for it; ignoring them keeps what they typed, since it may
// be a manga AniList doesn't know
export default function TitleField({ value, onChange, hits, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const shown = hits.slice(0, SHOWN);
  const showing = open && shown.length > 0;

  const pick = (hit: CoverHit) => {
    setOpen(false);
    setActive(-1);
    onPick(hit);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
    if (!showing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? shown.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(shown[active]!);
    }
  };

  return (
    <div className={styles.titleCombo}>
      <input
        className={styles.input}
        id="name"
        name="name"
        type="text"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showing && active >= 0 ? `${listId}-${active}` : undefined
        }
        placeholder="e.g. Berserk"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        minLength={3}
        maxLength={150}
        autoComplete="off"
        required
        autoFocus={!hasBottomBar()}
      />

      {showing && (
        <ul id={listId} role="listbox" className={list.suggestions}>
          {shown.map((hit, i) => (
            <li
              key={hit.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              className={`${list.suggestion} ${active === i ? list.suggestActive : ""}`}
              // keeps focus in the box, so the click lands before it closes
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(hit)}
              onMouseEnter={() => setActive(i)}
            >
              <span className={list.suggestThumb}>
                <img src={hit.cover} alt="" />
              </span>
              <span className={list.suggestText}>
                <span className={list.suggestName}>{hit.title}</span>
                {hit.year && (
                  <span className={list.suggestMeta}>{hit.year}</span>
                )}
              </span>
            </li>
          ))}
          <li className={styles.titleComboNote}>
            Not here? Your title works as typed.
          </li>
        </ul>
      )}
    </div>
  );
}

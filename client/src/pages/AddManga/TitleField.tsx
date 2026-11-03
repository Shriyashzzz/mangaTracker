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
  // the one under the mouse, to try on without choosing it; null when there's none
  onPreview: (hit: CoverHit | null) => void;
};

// The title box: AniList's closest guesses drop down as they type. Picking one
// uses AniList's name for it; ignoring them keeps what they typed, since it may
// be a manga AniList doesn't know
export default function TitleField({
  value,
  onChange,
  hits,
  onPick,
  onPreview,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [hovered, setHovered] = useState<CoverHit | null>(null);
  const listId = useId();
  const shown = hits.slice(0, SHOWN);
  const showing = open && shown.length > 0;

  // back to what they typed. The box only shows the hovered title: what they wrote
  // stays safe in `value` the whole time
  const endPreview = () => {
    setHovered(null);
    onPreview(null);
  };

  const pick = (hit: CoverHit) => {
    setOpen(false);
    setActive(-1);
    endPreview();
    onPick(hit);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // typing goes onto what they wrote, not the title being tried on
    if (e.key !== "Enter") endPreview();
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
        value={showing && hovered ? hovered.title : value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onPaste={endPreview}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          endPreview();
        }}
        onKeyDown={onKeyDown}
        minLength={3}
        maxLength={150}
        autoComplete="off"
        required
        autoFocus={!hasBottomBar()}
      />

      {showing && (
        <ul
          id={listId}
          role="listbox"
          className={list.suggestions}
          onMouseLeave={() => {
            setActive(-1);
            endPreview();
          }}
        >
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
              onMouseEnter={() => {
                setActive(i);
                setHovered(hit);
                onPreview(hit);
              }}
            >
              <span className={list.suggestThumb}>
                <img src={hit.cover} alt="" />
              </span>
              <span className={list.suggestText}>
                <span className={list.suggestName}>{hit.title}</span>
                {(hit.year || hit.lightNovel) && (
                  <span className={list.suggestMeta}>
                    {[hit.lightNovel && "Light novel", hit.year]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </span>
            </li>
          ))}
          <li
            className={styles.titleComboNote}
            onMouseEnter={() => {
              setActive(-1);
              endPreview();
            }}
          >
            Not here? Your title works as typed.
          </li>
        </ul>
      )}
    </div>
  );
}

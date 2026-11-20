// The shelf's bar. Wider than a phone, every view is a tab in a row (ALL 12 ·
// READING 8 · … · NEW 3), so they're all in sight. On phones what you're
// looking at is the title (READING 431 ⌄), and tapping it lists the others;
// New has its own place in the bottom bar there, with its count (and the
// tour's target). Search takes the rest
// of the row and never grows, so nothing moves when you click it; on phones it
// waits behind a magnifier and takes the title's place while open. Sorting is
// a menu: "Sorted by last updated" on laptops, a sort button on phones.
import { useCloseOnBack } from "../../lib/closeOnBack";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CloseIcon,
  SearchIcon,
  SortIcon,
} from "../../components/icons/Icons";
import { SORT_OPTIONS } from "../../lib/shelf";
import { shelfBarStyles as styles } from "./shelfBarStyles";
import { keepFocus } from "../../lib/keepFocus";
import { offlineLink, useIsOffline } from "../../lib/offline";

type ShelfView = {
  value: string;
  label: string;
  count: number | null;
};

// open, and closed again by a click elsewhere or Escape (focus back on its
// button)
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  // Android's back, or Escape
  useCloseOnBack(open, () => {
    setOpen(false);
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  });
  return { open, setOpen, ref };
}

// "Title, A to Z" reads "title, A to Z" after "Sorted by"
const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);

// A tab's count is how many are in it. New's is different: how many series
// have news, in red, and nothing at all when there's none (a grey 0 over a
// list of series they're behind on read as "nothing here")
const Count = ({ view }: { view: ShelfView }) => {
  if (view.count == null) return null;
  if (view.value !== "new")
    return <span className={styles.count}>{view.count}</span>;
  return view.count > 0 ? (
    <span className={styles.countNew}>{view.count}</span>
  ) : null;
};

export default function ShelfBar({
  views,
  current,
  onPick,
  query,
  onQuery,
  sortBy,
  onSort,
  layout,
  onLayout,
  onSelect,
}: {
  views: ShelfView[];
  current: string;
  onPick: (value: string) => void;
  query: string;
  onQuery: (q: string) => void;
  sortBy: string;
  onSort: (value: string) => void;
  // covers or compact rows, picked in the sort menu (also in Settings)
  // left out where there's no choice (the Volumes tab is rows only)
  layout?: "covers" | "rows";
  onLayout: (layout: "covers" | "rows") => void;
  // turns on Select; left out where cards can't be selected (New, Volumes)
  onSelect?: () => void;
}) {
  const shown = views.find((v) => v.value === current) ?? views[0]!;
  const offline = useIsOffline();
  // the view they were on before New, for the way back (All if they arrived
  // on New)
  const [cameFrom, setCameFrom] = useState(current === "new" ? "all" : current);
  if (current !== "new" && current !== cameFrom) setCameFrom(current);
  const back = views.find((v) => v.value === cameFrom) ?? views[0]!;
  // phones: search is behind the magnifier until it's opened or holds a query
  const [searchOpen, setSearchOpen] = useState(false);
  const searching = searchOpen || Boolean(query.trim());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);
  // Android's back, or Escape, clears and closes it before leaving the shelf
  useCloseOnBack(searching, () => {
    onQuery("");
    setSearchOpen(false);
  });

  return (
    <div className={styles.bar} data-shelf-bar>
      {/* wider than a phone: every view in sight */}
      <nav className={styles.tabs} aria-label="Your shelf">
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            className={styles.tab}
            aria-current={v.value === shown.value ? "page" : undefined}
            data-tour={v.value === "new" ? "tab-new" : undefined}
            onClick={() => onPick(v.value)}
            // New checks for releases: it needs a connection
            {...offlineLink(offline && v.value === "new")}
          >
            <span className={styles.tabWord}>{v.label}</span>
            <Count view={v} />
          </button>
        ))}
      </nav>
      <div className={searching ? styles.leadSearching : styles.lead}>
        <ViewMenu
          views={views}
          shown={shown}
          onPick={onPick}
          // the tour points at New: on New, that's the title
          tourTarget={current === "new" ? "tab-new" : undefined}
        />
        {/* on New: back to where they were */}
        {current === "new" && (
          <button
            type="button"
            className={styles.backStamp}
            onClick={() => onPick(back.value)}
            aria-label={`Back to ${back.label}`}
          >
            <ChevronLeftIcon className={styles.backArrow} />
            {back.label}
          </button>
        )}
      </div>

      <label className={searching ? styles.searchOpen : styles.search}>
        <SearchIcon />
        <span className="sr-only">Search your shelf</span>
        <input
          ref={input}
          type="search"
          // the browser's own clear button, hidden: Close search beside it
          // already clears, and two x's read as a mistake
          className="[&::-webkit-search-cancel-button]:appearance-none"
          data-shelf-search
          aria-keyshortcuts="/"
          placeholder="Title or genre"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) setSearchOpen(false);
          }}
          // the search box takes Escape for itself (it clears it), so it
          // never reaches useCloseOnBack: close it here too
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onQuery("");
              setSearchOpen(false);
            }
          }}
        />
        {/* the shortcut, where a keyboard is likely */}
        {!query && (
          <kbd className={styles.searchKey} aria-hidden>
            /
          </kbd>
        )}
        {searching && (
          <button
            type="button"
            className={styles.searchClose}
            aria-label="Close search"
            // before the input's blur, so a tap here always closes
            {...keepFocus}
            onClick={() => {
              onQuery("");
              setSearchOpen(false);
            }}
          >
            <CloseIcon />
          </button>
        )}
      </label>

      {!searching && (
        <button
          type="button"
          className={styles.magnifier}
          data-shelf-magnifier
          aria-label="Search your shelf"
          onClick={() => setSearchOpen(true)}
        >
          <SearchIcon />
        </button>
      )}
      {/* sort and Select together: a row of their own under the tabs, so a
          long tab row never pushes one of them down alone (on phones they
          stay beside the title) */}
      {(current !== "new" || onSelect) && (
        <div className={styles.tools}>
          {/* New lists what's out, newest first: sorting says little there */}
          {current !== "new" && (
            <SortMenu
              sortBy={sortBy}
              onSort={onSort}
              layout={layout}
              onLayout={onLayout}
            />
          )}
          {onSelect && (
            <button type="button" className={styles.select} onClick={onSelect}>
              Select
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ViewMenu({
  views,
  shown,
  onPick,
  tourTarget,
}: {
  views: ShelfView[];
  shown: ShelfView;
  onPick: (value: string) => void;
  tourTarget?: string;
}) {
  const { open, setOpen, ref } = useMenu();
  return (
    <div ref={ref} className={styles.menuWrap}>
      <button
        type="button"
        className={styles.title}
        data-tour={tourTarget}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Showing ${shown.label}${shown.count ? `, ${shown.count}` : ""}. Change what's shown`}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.titleWord}>{shown.label}</span>
        <span className={styles.titleCount}>
          <Count view={shown} />
        </span>
        <ChevronDownIcon className={styles.chevron} />
      </button>
      {open && (
        <Menu label="Show">
          {views.map((v) => (
            <li key={v.value}>
              <button
                type="button"
                className={styles.viewOption}
                aria-current={v.value === shown.value}
                onClick={() => {
                  onPick(v.value);
                  setOpen(false);
                }}
              >
                <span className={styles.viewOptionWord}>{v.label}</span>
                <Count view={v} />
              </button>
            </li>
          ))}
        </Menu>
      )}
    </div>
  );
}

const LAYOUTS = [
  { value: "covers", label: "Covers" },
  { value: "rows", label: "Compact rows" },
] as const;

// the shelf's sort menu, and the New tab piles' too (their own options, no
// "Show as"). The app's one dropdown: anywhere something is picked from a
// short list uses it, with its own `lead` words ("Collecting") and `wordy`,
// which keeps the words on phones where the shelf's shrinks to an icon
// the room a list needs to open from its button's left edge (it's about
// 15rem wide)
const MENU_ROOM = 250;

export function SortMenu<T extends string>({
  sortBy,
  onSort,
  options = SORT_OPTIONS as unknown as readonly { value: T; label: string }[],
  layout,
  onLayout,
  lead = "Sorted by",
  menuLabel = "Sort by",
  wordy = false,
  alignLeft = false,
  box = false,
  compact = false,
  id,
}: {
  // a box sized like a list's own small boxes (36px, 44px on a phone):
  // inside "Your books", beside the paid and date boxes
  compact?: boolean;
  // drawn as a form's box, as wide as what it's in: where a form or a
  // settings page picks from a list. The list opens under it and scrolls
  // when it's long
  box?: boolean;
  // for a <label htmlFor>, so pressing the label opens it
  id?: string;
  // the list opens from the button's left edge: for one that sits at the
  // left of its box, where opening from the right would run off the screen.
  // "auto" for a button that can be anywhere along a line (a tag that
  // wraps): from the left when the list fits that way, else from the right
  alignLeft?: boolean | "auto";
  // the words before the choice, and what the open list is called
  lead?: string;
  menuLabel?: string;
  // always spelled out: never the phone's sort icon
  wordy?: boolean;
  sortBy: T;
  onSort: (value: T) => void;
  options?: readonly { value: T; label: string }[];
  layout?: "covers" | "rows";
  onLayout?: (layout: "covers" | "rows") => void;
}) {
  const { open, setOpen, ref } = useMenu();
  // a boxed list opens upward when there's no room for it below
  const [opensUp, setOpensUp] = useState(false);
  // for alignLeft "auto": whether the list fits opening from the left
  const [fitsFromLeft, setFitsFromLeft] = useState(true);
  const fromLeft = alignLeft === "auto" ? fitsFromLeft : alignLeft;
  const picked = options.find((o) => o.value === sortBy) ?? options[0]!;
  // a name keeps its capital ("Deluxe"); a sort reads on from "Sorted by"
  const pickedText = wordy ? picked.label : lowerFirst(picked.label);
  const optionRows = options.map((o) => (
    <li key={o.value}>
      <button
        type="button"
        className={styles.sortOption}
        aria-current={o.value === picked.value}
        onClick={() => {
          onSort(o.value);
          setOpen(false);
        }}
      >
        {o.label}
        {o.value === picked.value && <CheckIcon className={styles.tick} />}
      </button>
    </li>
  ));
  if (box)
    return (
      <div ref={ref} className={styles.boxWrap}>
        <button
          type="button"
          id={id}
          className={compact ? styles.boxButtonCompact : styles.boxButton}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={`${menuLabel}: ${picked.label}. Change`}
          onClick={(e) => {
            // the list is up to 20rem tall: under the box if it fits there,
            // else above it when there's more room above
            const box = e.currentTarget.getBoundingClientRect();
            const listHeight = Math.min(320, innerHeight * 0.6);
            const roomBelow = innerHeight - box.bottom;
            setOpensUp(roomBelow < listHeight && box.top > roomBelow);
            setOpen(!open);
          }}
        >
          <span className={styles.boxWords}>{picked.label}</span>
          <ChevronDownIcon className={styles.boxChevron} />
        </button>
        {open && (
          <ul
            className={`${styles.menuBox} ${opensUp ? styles.menuBoxUp : ""}`}
            aria-label={menuLabel}
          >
            {optionRows}
          </ul>
        )}
      </div>
    );
  return (
    // the tour's "Compact rows" step points at the shelf's, the one with
    // "Show as"
    <div
      ref={ref}
      className={styles.sortWrap}
      data-tour={layout ? "sort" : undefined}
    >
      <button
        type="button"
        className={wordy ? styles.pickButton : styles.sortButton}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${wordy ? menuLabel : lead} ${pickedText}. Change`}
        onClick={(e) => {
          const left = e.currentTarget.getBoundingClientRect().left;
          setFitsFromLeft(left + MENU_ROOM <= innerWidth);
          setOpen(!open);
        }}
      >
        <span className={wordy ? styles.pickWords : styles.sortWords}>
          {lead} <span className={styles.sortPicked}>{pickedText}</span>
        </span>
        <ChevronDownIcon
          className={wordy ? styles.pickChevron : styles.sortChevron}
        />
        {!wordy && <SortIcon className={styles.sortIcon} />}
        {/* phones: something other than the default is on */}
        {!wordy && picked.value !== options[0]!.value && (
          <span className={styles.sortDot} aria-hidden />
        )}
      </button>
      {open && (
        <Menu label={menuLabel} alignRight={!fromLeft}>
          {optionRows}
          {/* how the shelf lists them, right where it's sorted, not only in
              Settings */}
          {layout && onLayout && (
            <li className={styles.menuHead} aria-hidden>
              Show as
            </li>
          )}
          {layout &&
            onLayout &&
            LAYOUTS.map((l) => (
              <li key={l.value}>
                <button
                  type="button"
                  className={styles.sortOption}
                  aria-current={l.value === layout}
                  onClick={() => {
                    onLayout(l.value);
                    setOpen(false);
                  }}
                >
                  {l.label}
                  {l.value === layout && <CheckIcon className={styles.tick} />}
                </button>
              </li>
            ))}
        </Menu>
      )}
    </div>
  );
}

const Menu = ({
  label,
  alignRight,
  children,
}: {
  label: string;
  alignRight?: boolean;
  children: ReactNode;
}) => (
  <ul
    className={alignRight ? styles.menuRight : styles.menu}
    aria-label={label}
  >
    <li className={styles.menuHead} aria-hidden>
      {label}
    </li>
    {children}
  </ul>
);

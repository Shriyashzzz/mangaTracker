// The shelf's bar: what you're looking at is its title (READING 431 ⌄), and
// tapping it lists the others. New keeps a red stamp beside it, so its count
// shows from every view (and the tour can point at it). Search takes the rest
// of the row and never grows, so nothing moves when you click it; on phones it
// waits behind a magnifier and takes the title's place while open. Sorting is
// a menu: "Sorted by last bookmarked" on laptops, a sort button on phones.
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

export type ShelfView = {
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
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return { open, setOpen, ref };
}

// "Title, A to Z" reads "title, A to Z" after "Sorted by"
const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);

// New's count is red wherever it shows: something's waiting there
const Count = ({ view }: { view: ShelfView }) =>
  view.count == null ? null : (
    <span
      className={
        view.value === "new" && view.count > 0 ? styles.countNew : styles.count
      }
    >
      {view.count}
    </span>
  );

export default function ShelfBar({
  views,
  current,
  onPick,
  query,
  onQuery,
  sortBy,
  onSort,
}: {
  views: ShelfView[];
  current: string;
  onPick: (value: string) => void;
  query: string;
  onQuery: (q: string) => void;
  sortBy: string;
  onSort: (value: string) => void;
}) {
  const shown = views.find((v) => v.value === current) ?? views[0]!;
  const fresh = views.find((v) => v.value === "new");
  // the view they were on before New, for the way back (All if they arrived
  // on New)
  const [cameFrom, setCameFrom] = useState(current === "new" ? "all" : current);
  if (current !== "new" && current !== cameFrom) setCameFrom(current);
  const back = views.find((v) => v.value === cameFrom) ?? views[0]!;
  // New doesn't take the title: it stays on where they were, and the NEW
  // stamp, in the same place, shows it's on (and takes them back)
  const onNew = current === "new";
  // phones: search is behind the magnifier until it's opened or holds a query
  const [searchOpen, setSearchOpen] = useState(false);
  const searching = searchOpen || Boolean(query.trim());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);

  return (
    <div className={styles.bar}>
      <div className={searching ? styles.leadSearching : styles.lead}>
        <ViewMenu
          views={views}
          titled={onNew ? back : shown}
          current={shown}
          onPick={onPick}
        />
        {/* New, from anywhere: pressed in while it's showing, and a tap then
            goes back to where they were */}
        {fresh && (
          <button
            type="button"
            data-tour="tab-new"
            className={onNew ? styles.newStampOn : styles.newStamp}
            aria-pressed={onNew}
            onClick={() => onPick(onNew ? back.value : "new")}
            aria-label={
              onNew
                ? `Showing New. Back to ${back.label}`
                : fresh.count
                  ? `New: ${fresh.count} series with something new`
                  : "New releases"
            }
          >
            {onNew && <CheckIcon className={styles.newStampTick} />}
            New
            {fresh.count != null && fresh.count > 0 && (
              <span className={styles.newStampCount}>{fresh.count}</span>
            )}
          </button>
        )}
        {onNew && (
          <span className={styles.onNewNote}>
            Showing New ·{" "}
            <button
              type="button"
              className={styles.backLink}
              onClick={() => onPick(back.value)}
            >
              <ChevronLeftIcon className={styles.backArrow} />
              back to {back.label}
            </button>
          </span>
        )}
      </div>

      <label className={searching ? styles.searchOpen : styles.search}>
        <SearchIcon />
        <span className="sr-only">Search your shelf</span>
        <input
          ref={input}
          type="search"
          placeholder="Find a title or genre"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onBlur={(e) => {
            if (!e.target.value.trim()) setSearchOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onQuery("");
              setSearchOpen(false);
            }
          }}
        />
        {searching && (
          <button
            type="button"
            className={styles.searchClose}
            aria-label="Close search"
            // before the input's blur, so a tap here always closes
            onPointerDown={(e) => e.preventDefault()}
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
          aria-label="Search your shelf"
          onClick={() => setSearchOpen(true)}
        >
          <SearchIcon />
        </button>
      )}
      <SortMenu sortBy={sortBy} onSort={onSort} />
    </div>
  );
}

function ViewMenu({
  views,
  titled,
  current,
  onPick,
}: {
  views: ShelfView[];
  // the title: what's shown, or on New, where they came from
  titled: ShelfView;
  current: ShelfView;
  onPick: (value: string) => void;
}) {
  const { open, setOpen, ref } = useMenu();
  return (
    <div ref={ref} className={styles.menuWrap}>
      <button
        type="button"
        className={styles.title}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Showing ${current.label}${current.count != null ? `, ${current.count}` : ""}. Change what's shown`}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.titleWord}>{titled.label}</span>
        <Count view={titled} />
        <ChevronDownIcon className={styles.chevron} />
      </button>
      {open && (
        <Menu label="Show">
          {views.map((v) => (
            <li key={v.value}>
              <button
                type="button"
                className={styles.viewOption}
                aria-current={v.value === current.value}
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

function SortMenu({
  sortBy,
  onSort,
}: {
  sortBy: string;
  onSort: (value: string) => void;
}) {
  const { open, setOpen, ref } = useMenu();
  const picked =
    SORT_OPTIONS.find((o) => o.value === sortBy) ?? SORT_OPTIONS[0]!;
  return (
    <div ref={ref} className={styles.sortWrap}>
      <button
        type="button"
        className={styles.sortButton}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Sorted by ${lowerFirst(picked.label)}. Change`}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.sortWords}>
          Sorted by{" "}
          <span className={styles.sortPicked}>{lowerFirst(picked.label)}</span>
        </span>
        <ChevronDownIcon className={styles.sortChevron} />
        <SortIcon className={styles.sortIcon} />
      </button>
      {open && (
        <Menu label="Sort by" alignRight>
          {SORT_OPTIONS.map((o) => (
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
                {o.value === picked.value && (
                  <CheckIcon className={styles.tick} />
                )}
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

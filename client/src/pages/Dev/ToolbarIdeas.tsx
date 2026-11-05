// A practice page, only in development (/dev/toolbar-ideas): five different
// shapes for the shelf's tab bar, each fixing the crowding and the search that
// jumps to a line of its own, each working, with a big library's numbers.
// Each also shows in a phone-sized frame (this page again, ?only=N, in an
// iframe, so the phone layouts really apply). Not shipped.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  SearchIcon,
} from "../../components/icons/Icons";

const TABS = [
  { value: "all", label: "All", count: 586 },
  { value: "ongoing", label: "Reading", count: 431 },
  { value: "finished", label: "Finished", count: 102 },
  { value: "planned", label: "To read", count: 53 },
  { value: "volumes", label: "Volumes", count: 389 },
  { value: "new", label: "New", count: 12 },
];
const SORTS = ["last bookmarked", "rating", "chapter", "name"];
const labelOf = (v: string) => TABS.find((t) => t.value === v)!;
const nextSort = (s: string) => SORTS[(SORTS.indexOf(s) + 1) % SORTS.length]!;

// a menu that closes on a click elsewhere or Escape
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement & HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const card =
  "rounded-ink border-[2.5px] border-line bg-card shadow-[0_14px_30px_-14px_rgba(20,14,8,0.45)] animate-drop motion-reduce:animate-none";
const quietLink =
  "tap text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current";
const searchInput =
  "min-w-0 flex-1 border-none bg-transparent text-[0.95rem] outline-none placeholder:text-muted";

// ---------- 1. spine tabs ----------

function SpineTabs() {
  const [active, setActive] = useState("all");
  const [sort, setSort] = useState(SORTS[0]!);
  return (
    <div className="flex items-end gap-6 border-b-[3px] border-double border-line upto-520:flex-col upto-520:items-stretch upto-520:gap-2 upto-520:border-b-0">
      <div
        className="flex items-end gap-2 upto-520:gap-[5px] upto-520:border-b-[3px] upto-520:border-double upto-520:border-line"
        role="group"
        aria-label="Status"
      >
        {TABS.map((t) => {
          const on = active === t.value;
          const isNew = t.value === "new";
          return (
            <button
              key={t.value}
              aria-pressed={on}
              onClick={() => setActive(t.value)}
              className={`tap relative flex w-[54px] flex-col items-center justify-between border-[1.5px] pt-2.5 pb-2 transition-[height,translate] duration-200 ease-ink upto-520:w-[calc((100%-25px)/6)] ${
                on
                  ? "h-[124px] -translate-y-1.5 border-line bg-ink text-paper shadow-ink"
                  : isNew
                    ? "h-[106px] border-line bg-accent text-on-accent hover:h-[112px]"
                    : "h-[106px] border-line bg-paper text-ink-soft hover:h-[112px] hover:text-ink"
              }`}
            >
              <span className="rotate-180 font-brand text-[1.2rem] leading-none tracking-[0.06em] uppercase [writing-mode:vertical-rl] upto-520:text-[1rem]">
                {t.label}
              </span>
              <span className="font-mono text-[0.75rem] tabular-nums upto-520:text-[0.66rem]">
                {t.count}
              </span>
              {on && (
                <span
                  className="absolute inset-x-1 top-1 h-[3px] bg-accent"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-2 upto-520:pb-0">
        <label className="flex min-h-11 items-center gap-2 border-b-[1.5px] border-dashed border-line-soft focus-within:border-solid focus-within:border-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted">
          <SearchIcon />
          <span className="sr-only">Search your shelf</span>
          <input
            type="search"
            placeholder="Find a title or genre"
            className={searchInput}
          />
        </label>
        <p className="text-[0.82rem] text-muted">
          {labelOf(active).label} · sorted by{" "}
          <button className={quietLink} onClick={() => setSort(nextSort(sort))}>
            {sort}
          </button>
        </p>
      </div>
    </div>
  );
}

// ---------- 2. the title is the filter ----------

function TitleFilter() {
  const [active, setActive] = useState("ongoing");
  const [sort, setSort] = useState(SORTS[0]!);
  const [searching, setSearching] = useState(false);
  const { open: menuOpen, setOpen: setMenuOpen, ref: menuRef } = useMenu();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) input.current?.focus();
  }, [searching]);
  const t = labelOf(active);
  return (
    <div className="flex min-h-[76px] items-center gap-8 border-b-[1.5px] border-line py-2 upto-520:gap-3">
      <div
        ref={menuRef}
        className={`relative shrink-0 ${searching ? "upto-520:hidden" : ""}`}
      >
        <button
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          className="tap group flex items-baseline gap-2 text-left"
        >
          <span className="font-brand text-[2.5rem] leading-none tracking-[0.02em] uppercase upto-520:text-[1.8rem]">
            {t.label}
          </span>
          <span
            className={`font-mono text-[0.9rem] tabular-nums ${t.value === "new" ? "rounded-[3px] bg-accent px-1.5 text-on-accent" : "text-muted"}`}
          >
            {t.count}
          </span>
          <ChevronDownIcon className="size-5 self-center text-ink-soft transition-transform duration-150 group-aria-expanded:rotate-180" />
        </button>
        {menuOpen && (
          <ul
            className={`absolute top-[calc(100%+10px)] left-0 z-30 w-60 p-1.5 ${card}`}
          >
            {TABS.map((x) => (
              <li key={x.value}>
                <button
                  onClick={() => {
                    setActive(x.value);
                    setMenuOpen(false);
                  }}
                  aria-current={x.value === active}
                  className="tap flex w-full items-baseline justify-between rounded-[2px] px-2.5 py-2 text-left hover:bg-accent-wash aria-[current=true]:bg-accent-wash"
                >
                  <span className="font-brand text-[1.15rem] tracking-[0.03em] uppercase">
                    {x.label}
                  </span>
                  <span
                    className={`font-mono text-[0.78rem] ${x.value === "new" ? "rounded-[3px] bg-accent px-1 text-on-accent" : "text-muted"}`}
                  >
                    {x.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* laptops: a wide search beside the title; phones: a magnifier that
          opens it in the title's place */}
      <label
        className={`min-w-0 flex-1 items-center gap-2 border-b-[1.5px] border-dashed border-line-soft py-1 focus-within:border-solid focus-within:border-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted ${searching ? "flex" : "flex upto-520:hidden"}`}
      >
        <SearchIcon />
        <span className="sr-only">Search your shelf</span>
        <input
          ref={input}
          type="search"
          placeholder="Find a title or genre"
          className={searchInput}
          onBlur={(e) => {
            if (!e.target.value) setSearching(false);
          }}
        />
      </label>
      {!searching && (
        <button
          className="tap ml-auto hidden size-10 place-items-center text-ink-soft upto-520:grid [&_svg]:size-5"
          aria-label="Search your shelf"
          onClick={() => setSearching(true)}
        >
          <SearchIcon />
        </button>
      )}
      <SortMenu sort={sort} setSort={setSort} />
    </div>
  );
}

// two arrows, one up and one down: the sort button on phones. Drawn like the
// app's own icons (components/icons/Icons.tsx): 24 grid, one stroke weight
const SortIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={className}
  >
    <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />
  </svg>
);

// sorting, as a menu: "Sorted by last bookmarked ⌄" on laptops, a sort button
// beside the magnifier on phones; the same card of choices either way
function SortMenu({
  sort,
  setSort,
}: {
  sort: string;
  setSort: (s: string) => void;
}) {
  const { open, setOpen, ref } = useMenu();
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Sort: ${sort}`}
        onClick={() => setOpen(!open)}
        className="tap group flex items-center gap-1 text-[0.88rem] text-ink-soft hover:text-ink upto-520:grid upto-520:size-10 upto-520:place-items-center"
      >
        <span className="upto-520:hidden">
          Sorted by{" "}
          <span className="font-medium text-ink underline decoration-line-soft underline-offset-3 group-hover:decoration-current">
            {sort}
          </span>
        </span>
        <ChevronDownIcon className="size-4 transition-transform duration-150 group-aria-expanded:rotate-180 upto-520:hidden" />
        <SortIcon className="hidden size-5 upto-520:block" />
      </button>
      {open && (
        <ul
          className={`absolute top-[calc(100%+10px)] right-0 z-30 w-56 p-1.5 ${card}`}
          aria-label="Sort by"
        >
          <li className="px-2.5 pt-1 pb-1.5 font-brand text-[0.95rem] tracking-[0.04em] text-ink-soft uppercase">
            Sort by
          </li>
          {SORTS.map((x) => (
            <li key={x}>
              <button
                aria-current={x === sort}
                onClick={() => {
                  setSort(x);
                  setOpen(false);
                }}
                className="tap flex w-full items-center justify-between gap-3 rounded-[2px] px-2.5 py-2 text-left text-ink hover:bg-accent-wash aria-[current=true]:font-semibold"
              >
                {x.charAt(0).toUpperCase() + x.slice(1)}
                {x === sort && <CheckIcon className="size-4 text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- 3. command bar ----------

function CommandBar() {
  const [active, setActive] = useState("ongoing");
  const [sort, setSort] = useState(SORTS[0]!);
  const [text, setText] = useState("");
  const { open: menuOpen, setOpen: setMenuOpen, ref: menuRef } = useMenu();
  const t = labelOf(active);
  return (
    <div className="py-3">
      <div ref={menuRef} className="relative">
        <div className="flex min-h-[52px] items-center gap-2 border-[2.5px] border-line bg-card px-3 py-1.5 shadow-ink focus-within:shadow-[4px_4px_0_var(--accent)] [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-ink-soft">
          <SearchIcon />
          {active !== "all" && (
            <span
              className={`inline-flex h-8 shrink-0 items-center gap-1 pl-2.5 font-medium ${t.value === "new" ? "bg-accent text-on-accent" : "bg-ink text-paper"}`}
            >
              {t.label}{" "}
              <span className="font-mono text-[0.75rem] opacity-80">
                {t.count}
              </span>
              <button
                className="tap grid size-8 place-items-center opacity-70 hover:opacity-100"
                aria-label={`Show everything, not just ${t.label}`}
                onClick={() => setActive("all")}
              >
                <CloseIcon className="size-3" />
              </button>
            </span>
          )}
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setMenuOpen(true)}
            placeholder={
              active === "all"
                ? "Search all 586, or pick a shelf…"
                : `Search ${t.label.toLowerCase()}…`
            }
            className="min-w-[6rem] flex-1 border-none bg-transparent text-[1rem] outline-none placeholder:text-muted"
          />
          <span className="shrink-0 font-mono text-[0.75rem] text-muted upto-520:hidden">
            by {sort}
          </span>
        </div>
        {menuOpen && (
          <div
            className={`absolute inset-x-0 top-[calc(100%+8px)] z-30 p-3 ${card}`}
          >
            <p className="mb-2 font-brand text-[0.95rem] tracking-[0.04em] text-ink-soft uppercase">
              Show
            </p>
            <div className="flex flex-wrap gap-2">
              {TABS.map((x) => (
                <button
                  key={x.value}
                  aria-pressed={x.value === active}
                  onClick={() => setActive(x.value)}
                  className="tap inline-flex h-9 items-center gap-1.5 border-[1.5px] border-dashed border-line-soft px-3 text-[0.9rem] text-ink-soft hover:border-line hover:text-ink aria-pressed:border-solid aria-pressed:border-line aria-pressed:bg-ink aria-pressed:text-paper"
                >
                  {x.label}
                  <span
                    className={`font-mono text-[0.72rem] ${x.value === "new" ? "rounded-[2px] bg-accent px-1 text-on-accent" : "opacity-70"}`}
                  >
                    {x.count}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 mb-2 font-brand text-[0.95rem] tracking-[0.04em] text-ink-soft uppercase">
              Sort by
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {SORTS.map((s) => (
                <button
                  key={s}
                  aria-pressed={s === sort}
                  onClick={() => setSort(s)}
                  className={`${quietLink} aria-pressed:text-ink aria-pressed:decoration-accent aria-pressed:decoration-2`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 4. binder tabs ----------

function BinderTabs() {
  const [active, setActive] = useState("all");
  const [sort, setSort] = useState(SORTS[0]!);
  return (
    <div className="pt-3">
      <div
        className="flex items-end overflow-x-auto pl-2 [scrollbar-width:none] upto-520:-mx-3 upto-520:px-3"
        role="group"
        aria-label="Status"
      >
        {TABS.map((t, i) => {
          const on = active === t.value;
          return (
            <button
              key={t.value}
              aria-pressed={on}
              onClick={() => setActive(t.value)}
              style={{ zIndex: on ? 20 : 10 - i }}
              className={`tap relative -mr-2.5 flex shrink-0 items-baseline gap-1.5 rounded-t-[10px] border-[1.5px] border-b-0 px-4 whitespace-nowrap transition-[padding,background-color] duration-150 ease-ink ${
                on
                  ? "-mb-[1.5px] border-line bg-card pt-2.5 pb-[calc(0.625rem+1.5px)] font-semibold text-ink"
                  : "border-line-soft bg-paper-2 pt-1.5 pb-1.5 text-ink-soft hover:pt-2 hover:text-ink"
              }`}
            >
              {t.value === "new" && (
                <span
                  className="size-2 self-center rounded-full bg-accent"
                  aria-hidden
                />
              )}
              {t.label}
              <span className="font-mono text-[0.72rem] font-normal text-muted">
                {t.count}
              </span>
            </button>
          );
        })}
      </div>
      {/* the folder: search and sort live inside it, so nothing above moves */}
      <div className="flex items-center gap-5 border-[1.5px] border-line bg-card px-4 py-2.5 shadow-ink upto-520:gap-3">
        <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted">
          <SearchIcon />
          <span className="sr-only">Search your shelf</span>
          <input
            type="search"
            placeholder={`Search ${labelOf(active).label.toLowerCase()}`}
            className={searchInput}
          />
        </label>
        <button
          className={`${quietLink} shrink-0`}
          onClick={() => setSort(nextSort(sort))}
        >
          by {sort}
        </button>
      </div>
    </div>
  );
}

// ---------- 5. a sentence ----------

function Sentence() {
  const [active, setActive] = useState("all");
  const [sort, setSort] = useState(SORTS[0]!);
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState("");
  const { open: showOpen, setOpen: setShowOpen, ref: showRef } = useMenu();
  const { open: orderOpen, setOpen: setOrderOpen, ref: orderRef } = useMenu();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) input.current?.focus();
  }, [searching]);
  const t = labelOf(active);
  const word =
    "tap inline-flex items-baseline gap-1 font-brand text-[1.35em] leading-none tracking-[0.02em] text-ink uppercase underline decoration-accent decoration-[2.5px] underline-offset-[5px] hover:decoration-line";
  const option =
    "tap flex w-full items-baseline justify-between gap-4 rounded-[2px] px-2.5 py-2 text-left text-ink hover:bg-accent-wash";
  return (
    <div className="flex min-h-[72px] items-center gap-4 border-b-[1.5px] border-line py-3 text-[1.05rem] upto-520:text-[0.98rem]">
      {searching ? (
        <label className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 text-ink-soft">
            Showing titles matching
          </span>
          <input
            ref={input}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setText("");
                setSearching(false);
              }
            }}
            className="min-w-0 flex-1 border-b-[2.5px] border-accent bg-transparent font-brand text-[1.35em] leading-none tracking-[0.02em] uppercase outline-none placeholder:font-sans placeholder:text-[0.75em] placeholder:tracking-normal placeholder:text-muted placeholder:normal-case"
            placeholder="a name or genre"
          />
        </label>
      ) : (
        <p className="min-w-0 flex-1 leading-[1.9] text-ink-soft">
          Showing{" "}
          <span ref={showRef} className="relative inline-block">
            <button
              className={word}
              aria-expanded={showOpen}
              onClick={() => setShowOpen(!showOpen)}
            >
              {t.value === "all" ? "everything" : t.label}
            </button>
            {showOpen && (
              <ul
                className={`absolute top-[calc(100%+6px)] left-0 z-30 w-56 p-1.5 text-[0.95rem] ${card}`}
              >
                {TABS.map((x) => (
                  <li key={x.value}>
                    <button
                      onClick={() => {
                        setActive(x.value);
                        setShowOpen(false);
                      }}
                      className={option}
                    >
                      {x.value === "all" ? "Everything" : x.label}
                      <span
                        className={`font-mono text-[0.75rem] ${x.value === "new" ? "rounded-[2px] bg-accent px-1 text-on-accent" : "text-muted"}`}
                      >
                        {x.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>{" "}
          <span className="font-mono text-[0.85em] text-muted">
            · {t.count} series,
          </span>{" "}
          <span ref={orderRef} className="relative inline-block">
            <button
              className={word}
              aria-expanded={orderOpen}
              onClick={() => setOrderOpen(!orderOpen)}
            >
              {sort}
            </button>
            {orderOpen && (
              <ul
                className={`absolute top-[calc(100%+6px)] left-0 z-30 w-52 p-1.5 text-[0.95rem] ${card}`}
              >
                {SORTS.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => {
                        setSort(s);
                        setOrderOpen(false);
                      }}
                      className={option}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>{" "}
          first
        </p>
      )}
      <button
        className="tap grid size-11 shrink-0 place-items-center border-[1.5px] border-line bg-card text-ink shadow-ink hover:-translate-y-px [&_svg]:size-5"
        aria-label={searching ? "Close search" : "Search your shelf"}
        onClick={() => {
          setText("");
          setSearching(!searching);
        }}
      >
        {searching ? <CloseIcon /> : <SearchIcon />}
      </button>
    </div>
  );
}

// ---------- the page ----------

const IDEAS: {
  name: string;
  pitch: string;
  good: string;
  bad: string;
  bar: () => ReactNode;
}[] = [
  {
    name: "Spine tabs",
    pitch:
      "The filters are books on the shelf line, like the volume picker. The one you're on is pulled out and inked; New is the red one. Six spines take 260px, so search gets the rest of the row and never moves.",
    good: "Unmistakably this app; huge room for search; fits a phone.",
    bad: "Labels read up the spine, which is slower to scan.",
    bar: () => <SpineTabs />,
  },
  {
    name: "The title is the filter",
    pitch:
      "A big brand heading names what you're looking at: READING 431. Tap it for the others. One wide search sits beside it. Sort is a menu: “Sorted by last bookmarked” on laptops, a sort button beside the magnifier on phones.",
    good: "The calmest bar; one thing to read; the heading does real work.",
    bad: "The other filters are behind a tap.",
    bar: () => <TitleFilter />,
  },
  {
    name: "Command bar",
    pitch:
      "One ink box: the filter you picked is a chip inside it. Click in and a card drops with every filter and sort. The bar itself never changes size.",
    good: "Search and filter are one gesture; room for any number of filters.",
    bad: "Not a glanceable row of tabs any more.",
    bar: () => <CommandBar />,
  },
  {
    name: "Binder tabs",
    pitch:
      "Divider tabs overlap along the top of a folder; the one you're on comes to the front and joins it. Search and sort live inside the folder.",
    good: "Physical and clear; on a phone the tabs slide sideways.",
    bad: "A little taller than today.",
    bar: () => <BinderTabs />,
  },
  {
    name: "A sentence",
    pitch:
      "“Showing READING · 431 series, LAST BOOKMARKED first.” Each big word is a menu. The magnifier turns it into “Showing titles matching ___”.",
    good: "Reads like the app talking; tiny; delightful.",
    bad: "Unusual: some won't spot at first that the words are menus.",
    bar: () => <Sentence />,
  },
];

export default function ToolbarIdeas() {
  const [params] = useSearchParams();
  const only = params.get("only");
  // in a phone frame: just the one bar, without the site around it
  useEffect(() => {
    if (only == null) return;
    document.documentElement.classList.add("dev-frame");
    return () => document.documentElement.classList.remove("dev-frame");
  }, [only]);
  if (only != null) {
    return (
      <div className="pt-1">
        <style>{`html.dev-frame header, html.dev-frame footer, html.dev-frame nav.fixed { display: none !important; }`}</style>
        {IDEAS[Number(only)]?.bar()}
        <p className="mt-5 text-center text-[0.8rem] text-muted">
          Your shelf would be here
        </p>
      </div>
    );
  }
  return (
    <div className="pb-24">
      <h1 className="font-brand text-[clamp(1.9rem,3.4vw,2.6rem)] leading-none tracking-[0.02em] uppercase">
        Shelf tab bar: five shapes
      </h1>
      <p className="mt-2 max-w-[62ch] text-ink-soft">
        Five different shapes for the shelf's bar, each without the crowding and
        without search jumping down. They all work: pick filters, search, sort.
        Big-library numbers (586 series). The frame under each is the same bar
        on an iPhone SE. Only on your machine, while developing.
      </p>
      <div className="mt-8 flex flex-col gap-12">
        {IDEAS.map((idea, i) => (
          <section key={idea.name} aria-labelledby={`bar-${i}`}>
            <h2
              id={`bar-${i}`}
              className="flex items-baseline gap-3 font-brand text-[1.6rem] leading-none tracking-[0.02em] uppercase"
            >
              <span className="bg-ink px-1.5 pt-0.5 text-paper">{i}</span>
              {idea.name}
            </h2>
            <p className="mt-2 max-w-[75ch] text-[0.95rem] text-ink-soft">
              {idea.pitch}
            </p>
            <p className="mt-1.5 text-[0.86rem]">
              <span className="font-semibold">Good:</span> {idea.good}{" "}
              <span className="font-semibold">Less good:</span> {idea.bad}
            </p>
            <div className="mt-4 pb-4" data-bar={i}>
              {idea.bar()}
              <p className="mt-4 text-center text-[0.8rem] text-muted">
                Your shelf would be here
              </p>
            </div>
            <iframe
              title={`${idea.name} on a phone`}
              src={`/dev/toolbar-ideas?only=${i}`}
              className="h-[230px] w-[375px] max-w-full border-[1.5px] border-line bg-paper"
            />
          </section>
        ))}
      </div>
    </div>
  );
}

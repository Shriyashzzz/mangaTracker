// The shelf's bar (ShelfBar.tsx). Pinned under the header; a row of tabs on
// wider screens (search and sort wrap under it when there's no room), one
// line with a view menu on phones. The title is the brand lettering; New is a
// red sticker like the old New stamp; menus are the account menu's ink card
const card =
  "absolute top-[calc(100%+10px)] z-30 rounded-ink border-[2.5px] border-line bg-card p-1.5 shadow-[0_14px_30px_-14px_rgba(20,14,8,0.45)] animate-drop motion-reduce:animate-none";
// phones only: wider screens have the tab row instead
const lead =
  "flex min-w-0 shrink-0 items-center gap-3 upto-520:gap-2 min-[721px]:hidden";
const search =
  "min-h-11 min-w-0 flex-1 items-center gap-2 border-b-[1.5px] border-dashed border-line-soft py-1 text-muted transition-[border-color] duration-200 focus-within:border-solid focus-within:border-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-none [&_input]:bg-transparent [&_input]:text-[0.95rem] [&_input]:text-ink [&_input]:outline-none [&_input]:placeholder:text-muted upto-760:[&_input]:text-[1rem]";

export const shelfBarStyles = {
  bar: "sticky top-0 z-5 -mx-3 mb-9 flex flex-wrap items-center gap-x-6 gap-y-2 border-b-[1.5px] border-line bg-[var(--surface,var(--paper))] px-3 py-[0.65rem] upto-520:mb-5 upto-520:gap-2 upto-520:py-[0.4rem] [&+nav]:-mt-4",
  lead,
  // phones: while searching, the search takes the title's place
  leadSearching: `${lead} upto-520:hidden`,

  // the views, side by side: the one you're on inked and underlined
  tabs: "mr-auto hidden min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1 min-[721px]:flex",
  tab: "tap group flex items-baseline gap-1.5 pt-1 pb-1.5 text-ink-soft shadow-[inset_0_-3px_0_transparent] transition-[color,box-shadow] duration-150 ease-ink hover:text-ink aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_-3px_0_var(--accent)]",
  tabWord: "font-brand text-[1.5rem] leading-none tracking-[0.03em] uppercase",

  menuWrap: "relative min-w-0",
  title: "tap group flex min-w-0 items-baseline gap-2 text-left",
  titleWord:
    "truncate font-brand text-[2.3rem] leading-[1.05] tracking-[0.02em] uppercase upto-520:text-[1.6rem]",
  // the title's count, a step up from the menu's
  titleCount: "[&>span]:text-[1.05rem] upto-520:[&>span]:text-[0.9rem]",
  count: "font-mono text-[0.85rem] text-muted tabular-nums",
  countNew:
    "rounded-[3px] bg-accent px-1.5 font-mono text-[0.8rem] text-on-accent tabular-nums",
  chevron:
    "size-5 shrink-0 self-center text-ink-soft transition-transform duration-150 group-aria-expanded:rotate-180 upto-520:size-4",
  // New, from any other view: a sticker, like the old stamp on the New tab
  newStamp:
    "tap inline-flex shrink-0 -rotate-[4deg] items-baseline gap-1 border-[1.5px] border-line bg-accent px-1.5 pt-[0.2rem] pb-[0.1rem] font-brand text-[1rem] leading-none tracking-[0.04em] text-on-accent uppercase shadow-ink transition-transform duration-150 ease-ink hover:rotate-0",
  newStampCount: "tabular-nums",
  // on New, the same sticker in plain ink: back to where they were
  backStamp:
    "tap inline-flex shrink-0 -rotate-[4deg] items-center gap-0.5 border-[1.5px] border-line bg-card py-[0.15rem] pr-2 pl-1 font-brand text-[1rem] leading-none tracking-[0.04em] text-ink uppercase shadow-ink transition-transform duration-150 ease-ink hover:rotate-0",
  backArrow: "size-4 shrink-0",

  search: `hidden ${search} min-[521px]:flex min-[721px]:min-w-40`,
  searchOpen: `flex ${search} min-[721px]:min-w-40`,
  searchKey:
    "hidden shrink-0 rounded-[3px] border-[1.5px] border-line-soft px-1.5 font-mono text-[0.75rem] leading-[1.4] text-muted min-[721px]:inline",
  searchClose:
    "tap grid size-8 shrink-0 place-items-center text-muted hover:text-ink [&_svg]:size-4",
  magnifier:
    "tap ml-auto hidden size-10 shrink-0 place-items-center text-ink-soft hover:text-ink upto-520:grid [&_svg]:size-5",

  sortWrap: "relative shrink-0",
  tools:
    "flex basis-full flex-row-reverse items-center justify-start gap-6 upto-520:contents",
  // turns on Select: a quiet text button at the end of the bar
  select:
    "tap shrink-0 text-[0.88rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  sortButton:
    "tap group relative flex items-center gap-1 text-[0.88rem] text-ink-soft hover:text-ink upto-520:grid upto-520:size-10 upto-520:place-items-center",
  sortWords: "whitespace-nowrap upto-520:hidden",
  // the same menu used away from the shelf (SortMenu's `wordy`): its words
  // stay on phones
  pickButton:
    "tap group relative flex min-h-9 items-center gap-1 text-[0.88rem] text-ink-soft hover:text-ink",
  pickWords: "whitespace-nowrap",
  pickChevron:
    "size-4 transition-transform duration-150 group-aria-expanded:rotate-180",
  sortPicked:
    "font-medium text-ink underline decoration-line-soft underline-offset-3 group-hover:decoration-current",
  sortChevron:
    "size-4 transition-transform duration-150 group-aria-expanded:rotate-180 upto-520:hidden",
  sortIcon: "hidden size-5 upto-520:block",
  sortDot:
    "absolute top-1.5 right-1.5 hidden size-2 rounded-full bg-accent upto-520:block",

  menu: `${card} left-0 w-60`,
  menuRight: `${card} right-0 w-56`,
  menuHead:
    "px-2.5 pt-1 pb-1.5 font-brand text-[0.95rem] tracking-[0.04em] text-ink-soft uppercase",
  viewOption:
    "tap flex w-full items-baseline justify-between gap-4 rounded-[2px] px-2.5 py-2 text-left hover:bg-accent-wash aria-[current=true]:bg-accent-wash",
  viewOptionWord: "font-brand text-[1.15rem] tracking-[0.03em] uppercase",
  sortOption:
    "tap flex w-full items-center justify-between gap-3 rounded-[2px] px-2.5 py-2 text-left text-ink hover:bg-accent-wash aria-[current=true]:font-semibold",
  tick: "size-4 text-accent",
} as const;

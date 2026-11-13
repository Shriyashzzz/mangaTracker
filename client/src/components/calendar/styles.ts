// The release calendar's pieces (MiniMonth, ReleaseList, VolumeCover): a
// small month page with release days circled in red marker, and a list of
// what comes out with the date written by hand. Used by the New tab's
// "Upcoming Releases" panel and the /calendar page alike
// a release's cover, two sizes
const coverBase =
  "cover-lines relative block aspect-2/3 shrink-0 overflow-hidden border-[1.5px] border-line bg-paper-2 [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:object-cover";

export const calendarParts = {
  // the month page: an inked header bar, then the days
  month:
    "border-2 border-line bg-card shadow-ink [&_header]:flex [&_header]:items-baseline [&_header]:justify-between [&_header]:gap-3 [&_header]:bg-ink [&_header]:px-3 [&_header]:py-2 [&_header]:text-paper",
  monthName:
    "font-brand text-[1.25rem] leading-none font-normal tracking-[0.04em] uppercase",
  monthCount: "font-mono text-[0.72rem]",
  grid: "grid grid-cols-7 gap-0.5 px-2 pt-1.5 pb-2.5",
  dow: "py-1 text-center font-mono text-[0.62rem] font-semibold text-muted",
  day: "relative grid aspect-square place-items-center font-mono text-[0.8rem] text-ink-soft",
  dayOut:
    "relative grid aspect-square place-items-center font-mono text-[0.8rem] text-line-soft",
  today:
    "font-semibold text-ink underline decoration-accent decoration-2 underline-offset-3",
  // a release day: the number bold and circled
  release: "font-semibold text-ink",
  circle:
    "pointer-events-none absolute -inset-0.5 size-[calc(100%+4px)] text-accent",

  // the list beside it
  list: "border-t-[1.5px] border-line",
  // a release: the date with Add to calendar under it, the release itself (a
  // link to its page), and Preorder at the right
  item: "grid grid-cols-[var(--date)_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-dashed border-line-soft [--date:4.4rem] upto-520:gap-x-2 upto-520:[--date:3.6rem]",
  // 3 or fewer beside a month's page: taller rows and bigger covers on
  // laptops, so the list reaches down beside it (phones: the list comes
  // first there, so it stays compact)
  itemRoomy: "min-[761px]:gap-x-4 min-[761px]:[--date:4.6rem]",
  // the day written by hand, level with the middle of the row, and Add to
  // calendar hanging under it (so it doesn't push the date up)
  when: "relative self-center",
  addSpot: "absolute top-full left-0 mt-1",
  row: "tap grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2 pr-1 hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed",
  rowRoomy:
    "tap grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-4 pr-1 hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed upto-760:gap-3 upto-760:py-2",
  nameRoomy: "truncate text-[1.1rem] font-semibold upto-760:text-base",
  // the date, written by hand; a second release on the same day leaves it out
  hand: "block min-h-[1lh] font-hand text-[1.4rem] leading-none font-medium text-accent upto-520:text-[1.2rem]",
  text: "flex min-w-0 flex-col",
  name: "truncate font-semibold",
  vol: "truncate font-mono text-[0.78rem] text-ink-soft",
  mine: "flex items-center gap-1 text-[0.75rem] font-semibold text-ok upto-520:col-start-2 upto-520:-mt-1",
  check: "size-3.5",
  // Preorder, at the right, level with the row
  preorderBox: "self-center pr-1",
  // to the stores on its price page: the row's main action, in red; on
  // smaller screens a red underlined word
  preorder:
    "tap inline-flex min-h-9 items-center border-[1.5px] border-line bg-accent px-2.5 py-1 text-[0.8rem] font-semibold whitespace-nowrap text-on-accent shadow-[2px_2px_0_var(--hard-shadow)] transition-[translate,box-shadow] duration-150 ease-ink hover:-translate-px hover:shadow-[3px_3px_0_var(--hard-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed upto-1100:border-0 upto-1100:bg-transparent upto-1100:px-0 upto-1100:text-[0.84rem] upto-1100:text-accent upto-1100:underline upto-1100:decoration-2 upto-1100:underline-offset-4 upto-1100:shadow-none upto-1100:hover:translate-0 upto-1100:hover:shadow-none",
  // only where Preorder is a plain word
  preorderArrow: "hidden upto-1100:ml-1 upto-1100:inline",
  more: "tap mt-2 text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",

  // Add to calendar: a quiet word under the date
  addBox: "relative shrink-0",
  add: "tap relative -mx-1 inline-flex h-6 items-center after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] gap-1 px-1 text-[0.76rem] font-medium whitespace-nowrap text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:outline-dashed aria-expanded:text-ink aria-expanded:decoration-current",
  addAll:
    "tap inline-flex items-center gap-2 border-2 border-line bg-card px-3.5 py-2 text-[0.88rem] font-semibold whitespace-nowrap shadow-ink transition-[translate] duration-150 ease-ink hover:-translate-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent focus-visible:outline-dashed aria-expanded:bg-accent-wash",
  addWord: "",
  addAllBox: "flex flex-wrap items-center gap-x-4 gap-y-1.5",
  addIcon: "size-4 shrink-0",
  addMenu:
    "absolute top-full left-0 z-20 mt-1 flex w-60 upto-520:w-56 flex-col border-2 border-line bg-card text-left shadow-ink animate-drop motion-reduce:animate-none",
  addItem:
    "tap flex w-full flex-col items-start gap-0.5 border-t border-dashed border-line-soft px-3 py-2.5 text-left text-[0.88rem] font-semibold text-ink first:border-t-0 hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent focus-visible:outline-dashed",
  addHint: "font-mono text-[0.7rem] font-normal text-muted",
  tbc: "shrink-0 font-mono text-[0.72rem] whitespace-nowrap text-muted",

  cover: `${coverBase} w-9 upto-520:w-8`,
  coverRoomy: `${coverBase} w-14 upto-760:w-9 upto-520:w-8`,
} as const;

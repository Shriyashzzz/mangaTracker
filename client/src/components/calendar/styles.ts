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
  // a release day: the number bold, circled, with a tag for the volume
  release: "font-semibold text-ink",
  circle:
    "pointer-events-none absolute -inset-0.5 size-[calc(100%+4px)] text-accent",
  tag: "absolute -top-2 -right-2 bg-accent px-1 font-brand text-[0.72rem] leading-[1.25] font-normal not-italic text-on-accent",

  // the list beside it
  list: "border-t-[1.5px] border-line",
  // the release (a link to its page) and, beside it, Add to calendar
  item: "flex items-center gap-3 border-b border-dashed border-line-soft",
  // 3 or fewer beside a month's page: taller rows and bigger covers on
  // laptops, so the list reaches down beside it (phones: the list comes
  // first there, so it stays compact)
  rowRoomy:
    "tap grid min-w-0 flex-1 grid-cols-[4.6rem_56px_minmax(0,1fr)_auto] items-center gap-4 py-4 pr-1 hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed upto-760:grid-cols-[4.4rem_36px_minmax(0,1fr)_auto] upto-760:gap-3 upto-760:py-2 upto-520:grid-cols-[3.6rem_32px_minmax(0,1fr)]",

  nameRoomy: "truncate text-[1.1rem] font-semibold upto-760:text-base",
  row: "tap grid min-w-0 flex-1 grid-cols-[4.4rem_36px_minmax(0,1fr)_auto] items-center gap-3 py-2 pr-1 hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed upto-520:grid-cols-[3.6rem_32px_minmax(0,1fr)]",
  // the date, written by hand; a second release on the same day leaves it out
  hand: "font-hand text-[1.4rem] leading-none font-medium text-accent upto-520:text-[1.2rem]",
  text: "flex min-w-0 flex-col",
  name: "truncate font-semibold",
  vol: "truncate font-mono text-[0.78rem] text-ink-soft",
  mine: "flex items-center gap-1 text-[0.75rem] font-semibold text-ok upto-520:col-start-3 upto-520:-mt-1",
  check: "size-3.5",
  more: "tap mt-2 text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",

  // Add to calendar: a small inked button, just the icon on phones
  addBox: "relative shrink-0",
  add: "tap inline-flex min-h-9 items-center gap-1.5 border-[1.5px] border-line bg-card px-2.5 py-1 text-[0.8rem] font-semibold whitespace-nowrap text-ink shadow-[2px_2px_0_var(--hard-shadow)] transition-[translate,box-shadow] duration-150 ease-ink hover:-translate-px hover:shadow-[3px_3px_0_var(--hard-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed aria-expanded:bg-accent-wash upto-520:min-h-11 upto-520:min-w-11 upto-520:justify-center upto-520:px-0",
  addAll:
    "tap inline-flex items-center gap-2 border-2 border-line bg-card px-3.5 py-2 text-[0.88rem] font-semibold whitespace-nowrap shadow-ink transition-[translate] duration-150 ease-ink hover:-translate-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent focus-visible:outline-dashed aria-expanded:bg-accent-wash",
  addWord: "upto-520:sr-only",
  addAllBox: "flex flex-wrap items-center gap-x-4 gap-y-1.5",
  addIcon: "size-4 shrink-0",
  addMenu:
    "absolute top-full right-0 z-20 mt-2 flex w-64 flex-col border-2 border-line bg-card text-left shadow-ink animate-drop motion-reduce:animate-none",
  addItem:
    "tap flex w-full flex-col items-start gap-0.5 border-t border-dashed border-line-soft px-3 py-2.5 text-left text-[0.88rem] font-semibold text-ink first:border-t-0 hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent focus-visible:outline-dashed",
  addHint: "font-mono text-[0.7rem] font-normal text-muted",
  tbc: "shrink-0 font-mono text-[0.72rem] whitespace-nowrap text-muted",

  cover: `${coverBase} w-9 upto-520:w-8`,
  coverRoomy: `${coverBase} w-14 upto-760:w-9 upto-520:w-8`,
} as const;

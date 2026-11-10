// The release calendar's pieces (MiniMonth, ReleaseList, VolumeCover): a
// small month page with release days circled in red marker, and a list of
// what comes out with the date written by hand. Used by the New tab's
// "Upcoming Releases" panel and the /calendar page alike
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
  tag: "absolute -top-1.5 -right-1.5 bg-accent px-[3px] font-brand text-[0.6rem] leading-[1.3] font-normal not-italic text-on-accent",

  // the list beside it
  list: "border-t-[1.5px] border-line",
  item: "border-b border-dashed border-line-soft",
  row: "tap grid grid-cols-[4.4rem_36px_minmax(0,1fr)_auto] items-center gap-3 py-2 pr-1 hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed upto-520:grid-cols-[3.6rem_32px_minmax(0,1fr)]",
  // the date, written by hand; a second release on the same day leaves it out
  hand: "font-hand text-[1.4rem] leading-none font-medium text-accent upto-520:text-[1.2rem]",
  text: "flex min-w-0 flex-col",
  name: "truncate font-semibold",
  vol: "truncate font-mono text-[0.78rem] text-ink-soft",
  mine: "flex items-center gap-1 text-[0.75rem] font-semibold text-ok upto-520:col-start-3 upto-520:-mt-1",
  check: "size-3.5",
  more: "tap mt-2 text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",

  cover:
    "cover-lines relative block aspect-2/3 w-9 shrink-0 overflow-hidden border-[1.5px] border-line bg-paper-2 [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:object-cover upto-520:w-8",
} as const;

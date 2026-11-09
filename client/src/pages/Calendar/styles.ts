// The release calendar (Calendar.tsx): the "How new works" page's heading and
// rules, with rows in the shelf's Volumes look (pages/Home/volumesStyles.ts)
export const calendarStyles = {
  page: "mx-auto flex max-w-[760px] flex-col gap-[clamp(1.25rem,4vw,2rem)]",
  head: "flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
  title:
    "font-brand text-[clamp(2.6rem,7vw,4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  back: "tap text-[0.9rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  lead: "-mt-1 max-w-[52ch] text-[1.05rem] leading-[1.5] text-ink-soft",
  note: "text-ink-soft",
  loading: "h-64 w-full",

  month: "flex flex-col gap-2",
  monthName:
    "font-brand text-[clamp(1.4rem,4vw,1.8rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",
  list: "border-t-[1.5px] border-line",
  item: "border-b border-dashed border-line-soft",
  row: "tap group flex items-center gap-3 py-2.5 pr-1 hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed",
  // the day, set like the shelf's counts
  date: "w-[4.2rem] shrink-0 font-brand text-[1.25rem] leading-none tracking-[0.02em] tabular-nums upto-520:w-14 upto-520:text-[1.05rem]",
  thumb:
    "cover-lines relative block h-[54px] w-9 shrink-0 overflow-hidden border-[1.5px] border-line bg-paper-2 [&>img]:size-full [&>img]:object-cover",
  ownCover: "absolute inset-0",
  text: "flex min-w-0 flex-1 flex-col",
  name: "truncate font-medium",
  vol: "truncate font-mono text-[0.82rem] text-ink-soft",
  owned:
    "flex shrink-0 items-center gap-1 text-[0.8rem] font-medium text-ink-soft upto-520:sr-only",
  check: "size-3.5 text-accent",

  empty:
    "mx-auto my-4 flex max-w-[460px] flex-col items-center gap-2 border-[1.5px] border-dashed border-line-soft p-8 text-center",
  emptyTitle: "font-display text-[1.5rem] font-semibold",
  emptyBody: "text-ink-soft",
} as const;

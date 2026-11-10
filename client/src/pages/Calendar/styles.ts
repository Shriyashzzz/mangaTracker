// The release calendar (Calendar.tsx): the "How new works" page's heading,
// then each month as the New tab panel shows it (components/calendar)
export const calendarStyles = {
  page: "mx-auto flex max-w-[980px] flex-col gap-[clamp(1.25rem,4vw,2rem)]",
  head: "flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
  title:
    "font-brand text-[clamp(2.6rem,7vw,4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  back: "tap text-[0.9rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  lead: "-mt-1 max-w-[52ch] text-[1.05rem] leading-[1.5] text-ink-soft",
  note: "text-ink-soft",
  addAll: "-mt-2 flex",
  // the month's page, with its own Save all dates under it
  monthSide: "flex flex-col items-start gap-3 upto-760:items-stretch",
  loading: "h-64 w-full",

  // a month: its page beside its list (stacked on narrow screens)
  month: "",
  monthBody:
    // on phones the list first, the month page under it
    "grid grid-cols-[300px_minmax(0,1fr)] items-start gap-6 upto-760:flex upto-760:flex-col-reverse upto-760:items-stretch upto-760:gap-4",
  // a later month, folded under its name and count
  folded: "group/month border-t-[1.5px] border-line",
  foldedSummary:
    "tap flex cursor-pointer list-none items-center gap-3 py-2 pr-1 pl-1 hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed [&::-webkit-details-marker]:hidden group-open/month:mb-3",
  foldedName:
    "font-brand text-[clamp(1.3rem,4vw,1.6rem)] leading-none font-normal tracking-[0.02em] uppercase",
  foldedCount: "font-mono text-[0.8rem] text-muted",
  // the first few covers, small and overlapping, like a stack on a table
  foldedPeek:
    "ml-2 flex items-center [&>span]:w-6 [&>span]:-ml-1.5 [&>span]:shadow-[1.5px_1.5px_0_var(--hard-shadow)] [&>span:first-child]:ml-0 upto-520:[&>span:nth-child(n+4)]:hidden",
  chevron:
    "ml-auto size-4 shrink-0 self-center text-muted transition-transform duration-150 group-open/month:rotate-180",

  empty:
    "mx-auto my-4 flex max-w-[460px] flex-col items-center gap-2 border-[1.5px] border-dashed border-line-soft p-8 text-center",
  emptyTitle: "font-display text-[1.5rem] font-semibold",
  emptyBody: "text-ink-soft",
} as const;

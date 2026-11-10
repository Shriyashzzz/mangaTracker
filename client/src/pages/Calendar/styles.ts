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
  loading: "h-64 w-full",

  // a month: its page beside its list (stacked on narrow screens)
  month: "",
  monthBody:
    "grid grid-cols-[300px_minmax(0,1fr)] items-start gap-6 upto-760:grid-cols-1 upto-760:gap-4",
  // a later month, folded under its name and count
  folded: "group/month border-t-[1.5px] border-line",
  foldedSummary:
    "tap flex cursor-pointer list-none items-baseline gap-3 py-3 pr-1 pl-1 hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed [&::-webkit-details-marker]:hidden group-open/month:mb-3",
  foldedName:
    "font-brand text-[clamp(1.3rem,4vw,1.6rem)] leading-none font-normal tracking-[0.02em] uppercase",
  foldedCount: "font-mono text-[0.8rem] text-muted",
  chevron:
    "ml-auto size-4 shrink-0 self-center text-muted transition-transform duration-150 group-open/month:rotate-180",

  empty:
    "mx-auto my-4 flex max-w-[460px] flex-col items-center gap-2 border-[1.5px] border-dashed border-line-soft p-8 text-center",
  emptyTitle: "font-display text-[1.5rem] font-semibold",
  emptyBody: "text-ink-soft",
} as const;

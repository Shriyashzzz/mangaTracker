// The New tab's "Upcoming Releases" panel (UpcomingReleases.tsx): a bold
// comic panel in the accent colour with speed lines, closed until asked;
// open, the calendar's month page and list on the card underneath
export const upcomingStyles = {
  // one row on a phone too, so the New tab's own list starts sooner
  panel: "group/up mb-5 upto-520:mb-3",
  summary:
    "tap relative grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden border-[3px] border-line bg-accent px-4 py-3 text-on-accent shadow-ink transition-[translate,box-shadow] duration-150 ease-ink hover:-translate-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent focus-visible:outline-dashed [&::-webkit-details-marker]:hidden before:pointer-events-none before:absolute before:-inset-[60%] before:bg-[repeating-conic-gradient(from_0deg_at_12%_50%,rgb(255_255_255/0.09)_0_4deg,transparent_4deg_12deg)] before:content-[''] upto-520:gap-3 upto-520:py-2",
  title:
    "relative -rotate-2 font-brand text-[1.9rem] leading-[0.9] font-normal tracking-[0.03em] uppercase [-webkit-text-stroke:1px_var(--hard-shadow)] upto-520:text-[1.2rem]",
  peek: "relative flex min-w-0 items-center gap-1.5",
  peekCover: "inline-block upto-520:hidden [&>span]:w-7",
  next: "ml-1.5 truncate text-[0.84rem] font-semibold",
  chevron:
    "relative size-5 shrink-0 transition-transform duration-200 ease-ink group-open/up:rotate-180",
  body: "grid grid-cols-[280px_minmax(0,1fr)] items-start gap-6 border-[3px] border-t-0 border-line bg-card p-4 animate-drop motion-reduce:animate-none upto-760:flex upto-760:flex-col-reverse upto-760:items-stretch upto-760:gap-4",
  monthActions:
    "mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2.5 [&>div]:flex [&>div>button]:h-full [&>div>button]:w-full [&>div>button]:justify-center [&>div>button]:px-2",
  all: "tap flex items-center justify-center border-2 whitespace-nowrap border-line bg-card px-2 py-2 text-center text-[0.88rem] font-semibold shadow-ink transition-[translate] duration-150 ease-ink hover:-translate-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent focus-visible:outline-dashed",
} as const;

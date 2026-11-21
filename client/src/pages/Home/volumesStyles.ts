// The shelf's Volumes tab (VolumesView.tsx). Rows are the shelf's own list
// look; opened, a series' volumes are the price checker's covers, small: ink
// border, the drawn placeholder with its number, the number tab in the corner
// (pages/Prices/styles.ts cover, coverFallback, vol)
export const volumesStyles = {
  summary: "mb-3 font-mono text-[0.85rem] text-muted tabular-nums",
  // the shelf's worth and what finishing it costs: two ledger entries under
  // the count, the amounts in the brand face like the row counts
  // "How much is my shelf worth?": closed until asked
  worth: "group/worth -mt-1 mb-4 border-y border-dashed border-line-soft",
  worthSummary:
    "tap flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 pr-1 pl-1 text-[0.92rem] font-semibold hover:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed [&::-webkit-details-marker]:hidden",
  // the worth in the folded line: the one number, inked
  worthAmount: "font-semibold text-ink",
  worthChevron:
    "size-4 shrink-0 text-muted transition-transform duration-150 group-open/worth:rotate-180",
  totals:
    "flex flex-wrap gap-x-10 gap-y-3 border-t border-dashed border-line-soft py-3 animate-drop motion-reduce:animate-none",
  total: "flex flex-col gap-0.5",
  totalLabel:
    "text-[0.78rem] font-semibold tracking-[0.06em] text-ink-soft uppercase",
  totalValue:
    "font-brand text-[1.6rem] leading-none tracking-[0.02em] tabular-nums",
  totalNote: "font-mono text-[0.75rem] text-muted tabular-nums",
  // "· 3 to go · about $31" after the owned volumes
  pagerBottom: "mt-8",
  // on paper, so the background art never sits behind a row's words
  list: "border-t-[1.5px] border-line-soft bg-paper",
  item: "border-b border-dashed border-line-soft",
  row: "tap group flex w-full items-center gap-3 py-2.5 pr-1 text-left hover:bg-accent-wash/40 aria-expanded:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed",
  thumb:
    "cover-lines relative block h-[54px] w-9 shrink-0 overflow-hidden border-[1.5px] border-line bg-paper-2 [&>img]:size-full [&>img]:object-cover",
  rowText: "flex min-w-0 flex-1 flex-col gap-1.5",
  // the name, the worth and the count on one line; the bar the row's width
  // under them, so every row's bar lines up
  rowTop: "flex min-w-0 items-baseline gap-3",
  name: "flex h-6 min-w-0 flex-1 items-baseline gap-2 leading-6 font-medium",
  nameText: "min-w-0 truncate",
  tag: "shrink-0 text-[0.75rem] font-medium text-muted uppercase tracking-[0.06em]",
  // the right of a row: the count, and what those volumes would fetch
  count:
    "h-6 shrink-0 font-brand text-[1.35rem] leading-6 tracking-[0.02em] tabular-nums",
  rowWorth: "shrink-0 font-mono text-[0.72rem] whitespace-nowrap text-muted",
  chevron:
    "size-4 shrink-0 text-muted transition-transform duration-150 group-aria-expanded:rotate-180",

  panel: "pb-5 pt-1 animate-drop motion-reduce:animate-none",
  panelHead:
    "mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
  panelSummary: "text-[0.9rem] font-semibold",
  edit: "tap text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  note: "mb-3 text-[0.84rem] text-ink-soft",
  vol: "absolute top-0 left-0 bg-ink pt-[0.15rem] pr-[0.6rem] pb-[0.05rem] pl-1.5 font-brand text-[1.05rem] leading-none tracking-[0.02em] text-paper [clip-path:polygon(0_0,100%_0,calc(100%-6px)_100%,0_100%)]",

  // under an opened series: what's left to buy and where
  finish: "mt-6 border-t border-dashed border-line-soft pt-4",
  finishHeading:
    "mb-1 flex items-baseline gap-3 font-body text-[0.9rem] font-semibold",
  finishTotal:
    "font-brand text-[1.2rem] font-normal tracking-[0.02em] tabular-nums",
  finishNote: "mb-2 text-[0.8rem] text-muted",
  finishList:
    "mb-2 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-x-6",
  finishRow:
    "flex items-baseline justify-between gap-3 border-b border-dotted border-line-soft py-1.5 text-[0.88rem]",
  finishVol: "shrink-0 font-medium tabular-nums",
  finishLink:
    "tap min-w-0 truncate text-right text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  finishPrice: "font-mono font-semibold text-ink tabular-nums",
  // the last row: how many more, and the page that has them
  // side by side once the list has columns; a phone keeps them at the edges
  finishRestRow: "min-[640px]:justify-start",
  finishRest: "min-w-0 truncate text-ink-soft tabular-nums",
  finishMore:
    "tap shrink-0 text-right font-medium whitespace-nowrap text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",

  empty:
    "mx-auto my-6 flex max-w-[460px] flex-col items-center gap-2 border-[1.5px] border-dashed border-line-soft p-8 text-center",
  emptyTitle: "font-display text-[1.5rem] font-semibold",
  emptyBody: "text-ink-soft",
} as const;

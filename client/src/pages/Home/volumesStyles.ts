// The shelf's Volumes tab (VolumesView.tsx). Rows are the shelf's own list
// look; opened, a series' volumes are the price checker's covers, small: ink
// border, the drawn placeholder with its number, the number tab in the corner
// (pages/Prices/styles.ts cover, coverFallback, vol)
export const volumesStyles = {
  summary: "mb-3 font-mono text-[0.85rem] text-muted tabular-nums",
  pagerBottom: "mt-8",
  list: "border-t-[1.5px] border-line-soft",
  item: "border-b border-dashed border-line-soft",
  row: "tap group flex w-full items-center gap-3 py-2.5 pr-1 text-left hover:bg-accent-wash/40 aria-expanded:bg-accent-wash/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent focus-visible:outline-dashed",
  thumb:
    "cover-lines relative block h-[54px] w-9 shrink-0 overflow-hidden border-[1.5px] border-line bg-paper-2 [&>img]:size-full [&>img]:object-cover",
  rowText: "flex min-w-0 flex-1 flex-col",
  name: "flex min-w-0 items-baseline gap-2 truncate font-medium",
  tag: "shrink-0 text-[0.75rem] font-medium text-muted uppercase tracking-[0.06em]",
  which: "truncate font-mono text-[0.82rem] text-ink-soft",
  count:
    "shrink-0 font-brand text-[1.35rem] leading-none tracking-[0.02em] tabular-nums",
  chevron:
    "size-4 shrink-0 text-muted transition-transform duration-150 group-aria-expanded:rotate-180",

  panel: "pb-5 pt-1 animate-drop motion-reduce:animate-none",
  panelHead:
    "mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
  panelSummary: "text-[0.9rem] font-semibold",
  edit: "tap text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  note: "mb-3 text-[0.84rem] text-ink-soft",
  tiles:
    "grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-x-3 gap-y-4 upto-520:grid-cols-[repeat(auto-fill,minmax(72px,1fr))]",
  tile: "group flex flex-col gap-1 focus-visible:outline-none",
  cover:
    "relative block aspect-2/3 overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-ink transition-[translate,box-shadow] duration-200 ease-ink group-hover:-translate-y-0.5 group-focus-visible:outline-2 group-focus-visible:outline-offset-3 group-focus-visible:outline-accent group-focus-visible:outline-dashed [&>img]:relative [&>img]:size-full [&>img]:object-cover",
  // not theirs yet: there, but faded and without its colour. The cover stays
  // solid (so the drawn number behind it only shows if it fails) under a
  // paper-coloured veil, which follows the theme
  coverToGet:
    "relative block aspect-2/3 overflow-hidden border-[1.5px] border-dashed border-line-soft bg-paper-2 transition-transform duration-200 ease-ink group-hover:-translate-y-0.5 group-focus-visible:outline-2 group-focus-visible:outline-offset-3 group-focus-visible:outline-accent group-focus-visible:outline-dashed [&>img]:relative [&>img]:size-full [&>img]:object-cover [&>img]:grayscale",
  veil: "absolute inset-0 bg-paper/60 transition-opacity duration-200 group-hover:opacity-40",
  coverNumber:
    "cover-lines absolute inset-0 grid place-items-center font-brand text-[1.8rem] text-muted",
  vol: "absolute top-0 left-0 bg-ink pt-[0.15rem] pr-[0.6rem] pb-[0.05rem] pl-1.5 font-brand text-[1.05rem] leading-none tracking-[0.02em] text-paper [clip-path:polygon(0_0,100%_0,calc(100%-6px)_100%,0_100%)]",
  label: "flex items-center gap-1 text-[0.8rem] font-medium",
  // can wrap to two lines under a narrow phone cover
  labelToGet: "text-[0.8rem] leading-tight text-balance text-muted",
  check: "size-3.5 text-accent",

  empty:
    "mx-auto my-6 flex max-w-[460px] flex-col items-center gap-2 border-[1.5px] border-dashed border-line-soft p-8 text-center",
  emptyTitle: "font-display text-[1.5rem] font-semibold",
  emptyBody: "text-ink-soft",
} as const;

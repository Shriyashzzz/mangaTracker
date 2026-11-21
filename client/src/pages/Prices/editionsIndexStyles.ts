// The /editions page (EditionsIndex.tsx): a series a row, its cover and name,
// then each of its edition lines drawn as books on a shelf
export const editionsIndexStyles = {
  list: "flex flex-col",
  // a series: cover at the left, its name and lines beside it
  series:
    "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-t-[1.5px] border-line py-5 first:border-t-0 upto-520:grid-cols-[2.75rem_minmax(0,1fr)] upto-520:gap-x-3",
  cover:
    "relative aspect-[2/3] w-full overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-ink",
  body: "flex min-w-0 flex-col gap-3",
  name: "tap font-display text-[1.3rem] leading-tight font-semibold text-ink hover:underline hover:decoration-accent upto-520:text-[1.15rem]",
  // a line: its name and facts over its shelf, the whole of it a link
  line: "tap group/line flex flex-col gap-1.5 rounded-ink py-1",
  lineHead:
    "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 font-sans",
  lineName:
    "font-brand text-[1.15rem] leading-none tracking-[0.04em] text-ink uppercase group-hover/line:text-accent",
  lineFacts: "font-mono text-[0.78rem] text-ink-soft",
  // the books side by side on a shelf (the series page's spines, still):
  // each as wide as the volumes it holds, on the volume ruler from the
  // line's first volume to its last
  shelf: "grid h-8 items-end gap-x-px border-b-[3px] border-double border-line",
  book: "flex h-full min-w-0 items-end justify-center overflow-hidden bg-ink pb-[3px] font-brand text-[0.72rem] leading-none text-paper group-hover/line:bg-accent",
  // the shelf's ends: which volumes it runs from and to
  ends: "flex justify-between font-mono text-[0.7rem] text-muted",
} as const;

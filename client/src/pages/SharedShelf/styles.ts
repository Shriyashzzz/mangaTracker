// Someone's shared shelf (SharedShelf.tsx): their name and what's on it, the
// series in Reading / Finished / To read, and a sheet with the volumes they
// own when one is tapped
export const shareStyles = {
  page: "flex flex-col gap-8 upto-520:gap-6",

  // who, how much, and the link to pass on
  head: "flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b-[1.5px] border-line pb-6",
  who: "flex min-w-0 items-center gap-4",
  art: "w-20 shrink-0 upto-520:w-16",
  name: "font-brand text-[2.4rem] leading-none font-normal tracking-[0.02em] text-balance uppercase upto-520:text-[1.9rem]",
  // the shelf in numbers, as one line of print
  tally:
    "mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.8rem] text-ink-soft [&_b]:font-semibold [&_b]:text-ink",
  actions: "flex flex-wrap gap-2.5 upto-520:w-full upto-520:[&>*]:flex-1",
  action: "btn btn-secondary gap-2 [&_svg]:size-4",

  // find and order
  tools:
    "flex flex-wrap items-center gap-3 upto-520:flex-col upto-520:items-stretch",
  search:
    "relative flex min-w-0 flex-1 items-center [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:left-3 [&>svg]:size-4 [&>svg]:text-muted",
  searchInput:
    "h-11 w-full max-w-[26rem] border-[1.5px] border-line bg-card pr-3 pl-9 text-[0.95rem] placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed upto-520:max-w-none",
  sorts: "flex items-center gap-1 font-mono text-[0.78rem] text-muted",
  sort: "tap px-2 py-1.5 text-ink-soft underline decoration-transparent underline-offset-4 hover:text-ink hover:decoration-line-soft",
  sortOn:
    "tap px-2 py-1.5 font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4",
  // the order and the layout, side by side
  controls:
    "flex flex-wrap items-center gap-x-4 gap-y-1 upto-520:justify-between",
  views:
    "flex items-center border-l-[1.5px] border-line-soft pl-3 font-mono text-[0.78rem] text-muted upto-520:border-l-0 upto-520:pl-0",

  // one reading status
  section: "group/section",
  sectionHead:
    "tap flex cursor-pointer list-none items-baseline gap-3 border-b-[1.5px] border-line-soft pb-2 [&::-webkit-details-marker]:hidden",
  sectionName:
    "font-brand text-[1.5rem] leading-none font-normal tracking-[0.03em] uppercase",
  sectionCount: "font-mono text-[0.8rem] text-muted",
  sectionFold:
    "ml-auto size-4 text-muted transition-transform duration-200 ease-ink group-open/section:rotate-180",
  grid: "mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6 gap-y-9 upto-520:grid-cols-2 upto-520:gap-x-4 upto-520:gap-y-7",

  // a series: tap for its sheet
  card: "group/card relative flex w-full min-w-0 cursor-pointer flex-col gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent focus-visible:outline-dashed",
  cover:
    "relative aspect-2/3 border-[1.5px] border-line bg-paper-2 shadow-ink-lg transition-[translate,box-shadow] duration-200 ease-ink group-hover/card:-translate-y-1",
  stamp:
    "absolute top-2.5 right-2 rotate-8 rounded-[3px] border-2 border-accent-hover bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-2 py-[0.15rem] font-brand text-[1rem] leading-[1.2] tracking-[1.5px] text-accent-hover",
  // the first visit's pointer to the first series
  tapMe:
    "pointer-events-none absolute -bottom-3 -left-2 z-[1] -rotate-6 bg-accent px-2 py-0.5 font-brand text-[1rem] leading-[1.3] tracking-[0.06em] text-on-accent shadow-[2px_2px_0_var(--hard-shadow)] animate-drop",
  cardName:
    "line-clamp-2 font-display text-[1.05rem] leading-[1.25] font-semibold group-hover/card:underline group-hover/card:decoration-accent group-hover/card:decoration-2 group-hover/card:underline-offset-3",
  cardMeta: "truncate font-mono text-[0.76rem] text-muted",
  cardVols: "font-mono text-[0.76rem] font-semibold text-ink",

  // compact: a small cover and three short lines, so more fit on a screen
  rows: "mt-2 grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-8 upto-520:grid-cols-[minmax(0,1fr)]",
  row: "border-b-[1.5px] border-line-soft",
  rowCard:
    "group/card relative grid w-full min-w-0 cursor-pointer grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  rowCover:
    "relative aspect-2/3 border-[1.5px] border-line bg-paper-2 shadow-ink transition-[translate] duration-200 ease-ink group-hover/card:-translate-y-0.5",
  rowText: "flex min-w-0 flex-col gap-[0.15rem]",
  rowName:
    "truncate font-display text-[1.02rem] leading-[1.25] font-semibold group-hover/card:underline group-hover/card:decoration-accent group-hover/card:decoration-2 group-hover/card:underline-offset-3",
  rowMore:
    "flex min-h-[1.2rem] min-w-0 items-center gap-3 font-mono text-[0.76rem] text-muted [&>span]:truncate",
  rowTapMe:
    "pointer-events-none absolute right-2 bottom-2 z-[1] -rotate-6 bg-accent px-2 py-0.5 font-brand text-[1rem] leading-[1.3] tracking-[0.06em] text-on-accent shadow-[2px_2px_0_var(--hard-shadow)] animate-drop",

  nothing: "py-6 text-ink-soft",

  // someone without an account, at the end of the shelf
  invite:
    "flex flex-wrap items-center gap-x-6 gap-y-3 border-2 border-line bg-card px-5 py-4 shadow-ink upto-520:flex-col upto-520:items-start",
  inviteArt: "w-16 shrink-0",
  inviteText: "flex min-w-0 flex-1 flex-col gap-0.5",
  inviteHead:
    "font-brand text-[1.35rem] leading-tight tracking-[0.02em] uppercase",
  inviteBody: "max-w-[52ch] text-[0.92rem] text-ink-soft",

  // the series sheet: from the bottom on phones, the right on laptops
  sheet:
    "fixed m-0 mt-auto ml-auto flex max-h-none w-[min(30rem,100vw)] flex-col border-l-[2.5px] border-line bg-card text-ink shadow-ink-lg backdrop:bg-[rgba(20,14,8,0.55)] open:animate-sheet-in min-[721px]:h-dvh upto-720:max-h-[88dvh] upto-720:w-screen upto-720:max-w-none upto-720:border-t-[2.5px] upto-720:border-l-0 upto-720:open:animate-sheet-up",
  sheetHead:
    "flex items-start justify-between gap-4 border-b-[1.5px] border-line px-5 pt-5 pb-4",
  sheetTitle:
    "font-brand text-[1.7rem] leading-[1.05] font-normal tracking-[0.02em] text-balance uppercase",
  sheetClose:
    "tap -mr-2 grid size-10 shrink-0 place-items-center text-ink-soft hover:text-ink [&_svg]:size-4",
  sheetBody: "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5",
  sheetTop: "flex gap-4",
  sheetCover:
    "relative aspect-2/3 w-24 shrink-0 border-[1.5px] border-line bg-paper-2",
  facts:
    "grid content-start grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.9rem] [&_dt]:font-mono [&_dt]:text-[0.74rem] [&_dt]:text-muted [&_dt]:uppercase [&_dt]:self-center",
  label:
    "mb-2 font-brand text-[1.15rem] leading-none tracking-[0.03em] uppercase",
  ranges: "mt-2 font-mono text-[0.8rem] text-ink-soft",
  notes: "leading-[1.55] whitespace-pre-line wrap-anywhere",
  sheetFoot:
    "flex flex-wrap gap-2.5 border-t-[1.5px] border-line px-5 py-4 upto-520:[&>*]:flex-1",

  // the volumes they own, as spines on a shelf; a gap stands empty
  spines:
    "flex flex-wrap items-end gap-x-[3px] gap-y-3 border-b-[3px] border-double border-line pb-[3px]",
  spine:
    "grid h-16 w-[22px] place-items-end justify-center border-[1.5px] border-line bg-paper-2 pb-1 font-mono text-[0.62rem] font-semibold text-ink shadow-[1px_0_0_var(--line)] [writing-mode:vertical-rl] odd:bg-card",
  gap: "grid h-12 w-[22px] place-items-end justify-center border-[1.5px] border-dashed border-line-soft pb-1 font-mono text-[0.62rem] text-muted [writing-mode:vertical-rl]",
} as const;

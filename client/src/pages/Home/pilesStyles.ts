// The New tab's piles (NewPiles.tsx): each pile under an inked rule with its
// name in the brand face, a fan of covers with hard shadows, and on a pile's
// own page the chips between them (two by two on phones, so the row fills)
const chipBase =
  "tap inline-flex items-center justify-center gap-1.5 border-[1.5px] border-line px-3 py-1.5 text-[0.84rem] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed";

export const pilesStyles = {
  piles: "mb-6 flex flex-col",
  pile: "border-t-[1.5px] border-line pt-3 pb-4",
  pileHead: "flex items-baseline justify-between gap-3",
  pileName:
    "font-brand text-[1.35rem] leading-none font-normal tracking-[0.04em] uppercase",
  pileCount: "ml-1 font-mono text-[0.8rem] tracking-normal text-muted",
  seeAll:
    "tap shrink-0 text-[0.9rem] font-semibold underline decoration-accent decoration-2 underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  why: "mt-1 mb-3 text-[0.84rem] text-muted",
  fan: "flex flex-wrap gap-2.5",
  fanCover:
    "group/cover tap relative block w-[58px] pt-3 transition-[translate] duration-150 ease-ink hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed upto-520:w-[48px]",
  fanArt:
    "relative block aspect-2/3 overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-[3px_3px_0_var(--hard-shadow)] [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:object-cover",
  // the series' name, in a small inked caption box under the cover while
  // it's hovered or focused (hover only where there's a pointer). As wide as
  // the name, up to a cap: one line, a long name cut short
  caption:
    "pointer-events-none absolute top-full left-1/2 z-10 mt-2 block w-max max-w-44 -translate-x-1/2 truncate -translate-y-1 border-[1.5px] border-line bg-card px-2 py-1 text-center text-[0.76rem] leading-[1.35] font-semibold text-ink opacity-0 shadow-[2px_2px_0_var(--hard-shadow)] transition-[opacity,translate] duration-150 ease-ink group-hover/cover:translate-y-0 group-hover/cover:opacity-100 group-focus-visible/cover:translate-y-0 group-focus-visible/cover:opacity-100 motion-reduce:transition-none",
  // which volume, stamped across the top of the cover
  stamp:
    "absolute top-0 left-1/2 -translate-x-1/2 -rotate-3 border-[1.5px] border-line bg-accent px-1.5 font-brand text-[0.95rem] leading-[1.2] tracking-[0.03em] upto-520:text-[0.85rem] whitespace-nowrap text-on-accent",
  fanMore:
    "mt-3 grid aspect-2/3 w-[58px] cursor-pointer place-items-center font-brand text-[1.25rem] text-ink-soft hover:text-accent upto-520:w-[48px]",

  // a pile's own page
  // one line each, whichever pile, so the chips under them never move
  headTop: "flex items-baseline justify-between gap-4",
  headTitle:
    "min-w-0 truncate outline-none font-brand text-[clamp(1.7rem,5vw,2.2rem)] leading-[1.1] font-normal tracking-[0.03em] uppercase",
  headWhy: "mt-1 mb-3 truncate text-[0.84rem] text-muted",
  back: "tap shrink-0 text-[0.9rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  // stuck under the shelf bar while the pile scrolls by
  chips:
    "sticky z-4 -mx-3 mb-7 flex flex-wrap gap-2 border-b-[1.5px] border-line bg-[var(--surface,var(--paper))] px-3 py-2 upto-520:grid upto-520:grid-cols-2 upto-520:[&>*:first-child]:col-span-2",
  chip: `${chipBase} bg-card hover:bg-accent-wash disabled:cursor-default disabled:opacity-45 disabled:hover:bg-card`,
  chipOn: `${chipBase} bg-ink text-paper`,
  chipCount: "font-mono text-[0.74rem] opacity-75",
} as const;

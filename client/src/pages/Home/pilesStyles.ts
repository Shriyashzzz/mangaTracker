// The New tab's piles (NewPiles.tsx): each pile under an inked rule with its
// name in the brand face, a fan of covers with hard shadows, and on a pile's
// own page the chips between them (one sideways-scrolling row on phones)
const chipBase =
  "tap inline-flex items-center justify-center gap-1.5 border-[1.5px] border-line px-3 py-1.5 text-[0.84rem] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed";

export const pilesStyles = {
  piles: "mb-6 flex flex-col",
  pile: "border-t-[1.5px] border-line pt-3 pb-4",
  pileHead: "flex items-baseline justify-between gap-3",
  pileName:
    "font-brand text-[1.35rem] leading-none font-normal tracking-[0.04em] uppercase",
  pileCount: "ml-1 font-mono text-[0.8rem] tracking-normal text-muted",
  // a bigger target than the word: a full row's height on phones
  seeAll:
    "tap inline-flex min-h-11 shrink-0 items-center px-1 text-[0.9rem] font-semibold underline decoration-accent decoration-2 underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  why: "mt-1 mb-3 text-[0.84rem] text-muted",
  fan: "flex flex-wrap gap-2.5",
  fanCover:
    "group/cover tap relative block w-[58px] pt-3 transition-[translate] duration-150 ease-ink hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed upto-520:w-[48px]",
  fanArt:
    "relative block aspect-2/3 overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-[3px_3px_0_var(--hard-shadow)] [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:object-cover",
  // which volume, stamped across the top of the cover
  stamp:
    "absolute top-0 left-1/2 -translate-x-1/2 -rotate-3 border-[1.5px] border-line bg-accent px-1.5 font-brand text-[0.95rem] leading-[1.2] tracking-[0.03em] upto-520:text-[0.85rem] whitespace-nowrap text-on-accent",
  // how far behind: small and grey. On a laptop it's stamped at the foot of
  // the cover; on a phone's narrower covers it's a line under the cover,
  // where a bare number on the art read as a volume number
  behind:
    "app-min-text absolute bottom-1 left-1/2 -translate-x-1/2 border border-line-soft bg-card px-1 font-mono text-[0.6rem] leading-[1.5] whitespace-nowrap text-ink-soft upto-520:static upto-520:-mx-1.5 upto-520:mt-1 upto-520:block upto-520:translate-x-0 upto-520:border-0 upto-520:bg-transparent upto-520:px-0 upto-520:text-center upto-520:font-sans upto-520:text-[0.64rem] upto-520:leading-[1.2]",
  // a light novel's cover, marked so it isn't taken for the manga of the
  // same name beside it (Overlord's two)
  novel:
    "absolute top-[calc(0.75rem+1.2rem)] left-[1.5px] bg-ink px-0.5 font-mono text-[0.55rem] leading-[1.4] tracking-[0.04em] text-paper uppercase",
  fanMore:
    "mt-3 grid aspect-2/3 w-[58px] cursor-pointer place-items-center font-brand text-[1.25rem] text-ink-soft hover:text-accent upto-520:w-[48px]",

  // a pile's own page
  // one line each, whichever pile, so the chips under them never move
  headTop: "flex items-baseline justify-between gap-4",
  headTitle:
    "min-w-0 truncate outline-none font-brand text-[clamp(1.7rem,5vw,2.2rem)] leading-[1.1] font-normal tracking-[0.03em] uppercase",
  headWhy: "mt-1 truncate text-[0.84rem] text-muted",
  back: "tap shrink-0 text-[0.9rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  // stuck under the shelf bar while the pile scrolls by
  chips:
    "sticky z-4 -mx-3 mt-3 mb-7 flex items-center gap-2 border-b-[1.5px] border-line px-3 py-2 upto-520:mb-4",
  chipsStuck:
    "sticky z-4 -mx-3 mt-3 mb-7 flex items-center gap-2 border-b-[1.5px] border-line bg-[var(--surface,var(--paper))] px-3 py-2 upto-520:mb-4",
  // wraps on wider screens; one sideways-scrolling row on phones (a chip
  // cut off at an edge is the sign there's more; a fade there hid the open
  // pile's own chip when the row was scrolled to its end)
  chipList:
    "relative flex min-w-0 flex-1 flex-wrap gap-2 upto-520:flex-nowrap upto-520:overflow-x-auto upto-520:[scrollbar-width:none] upto-520:[&>*]:shrink-0",
  // the pile's order, at the end of the chip row
  sort: "ml-auto flex shrink-0 items-center",
  chip: `${chipBase} bg-card hover:bg-accent-wash disabled:cursor-default disabled:opacity-45 disabled:hover:bg-card`,
  chipOn: `${chipBase} bg-ink text-paper`,
  chipCount: "font-mono text-[0.74rem] opacity-75",
} as const;

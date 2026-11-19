// Tailwind classes for Your year in manga: a page of manga panels. The
// cards' colours are the stamp inks, light in both themes, so their
// lettering is always the stamp ink (dark), never the theme's ink.
const panel =
  "relative flex min-h-[15rem] upto-760:min-h-[12rem] flex-col justify-end gap-1.5 overflow-hidden border-[3px] border-[var(--stamp-ink)] p-6 text-[var(--stamp-ink)] shadow-[7px_7px_0_var(--hard-shadow)] data-[tilt=left]:-rotate-[0.6deg] data-[tilt=right]:rotate-[0.6deg] motion-reduce:rotate-0";

export const yearStyles = {
  page: "px-gutter mx-auto max-w-[1040px] py-10",
  grid: "grid grid-cols-2 gap-x-7 gap-y-8 upto-760:grid-cols-1 upto-760:gap-y-6",
  // the opening panel: inked, speed lines behind Kenji and the title
  opening:
    "year-rays relative col-span-full flex items-center justify-start gap-8 overflow-hidden border-[3px] border-line bg-ink p-7 text-paper shadow-[7px_7px_0_var(--accent)] upto-560:flex-col upto-560:items-start upto-560:gap-4",
  title:
    "font-brand text-[clamp(3rem,9vw,5.5rem)] leading-[0.92] tracking-[0.02em] uppercase",
  titleHit:
    "inline-block -rotate-2 bg-paper px-3 text-ink shadow-[6px_6px_0_var(--accent)]",
  openingSmall: "mt-3 text-[1rem] text-paper/80",
  card: panel,
  cardWide: `${panel} col-span-full`,
  big: "font-brand text-[clamp(4rem,11vw,6.5rem)] leading-[0.9] tracking-[0.02em]",
  say: "text-[clamp(1.1rem,2.6vw,1.35rem)] font-semibold",
  small: "text-[0.98rem] leading-[1.45] opacity-85",
  heading:
    "font-brand text-[clamp(2.2rem,6vw,3.2rem)] leading-none tracking-[0.02em] uppercase",
  // the fanned covers, a row of their own at the top right of a card
  covers: "mb-auto flex self-end pb-3",
  cover:
    "relative block aspect-[2/3] w-[4.4rem] overflow-hidden border-[2px] [&_img]:size-full [&_img]:object-cover border-[var(--stamp-ink)] shadow-[3px_3px_0_var(--stamp-ink)] [&:not(:first-child)]:-ml-6 nth-1:-rotate-6 nth-2:rotate-3 nth-3:rotate-8 upto-560:w-14",
} as const;

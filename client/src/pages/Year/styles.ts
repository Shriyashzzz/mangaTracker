// Tailwind classes for Your year in manga: a page of manga panels. The
// cards' colours are the stamp inks, light in both themes, so their
// lettering is always the stamp ink (dark), never the theme's ink. On a
// phone the cards are a row to swipe through, one in view at a time.
const panel =
  "printed relative flex min-h-[15rem] flex-col justify-end gap-1.5 overflow-hidden border-[3px] border-[var(--stamp-ink)] p-6 text-[var(--stamp-ink)] shadow-[7px_7px_0_var(--hard-shadow)] data-[tilt=left]:-rotate-[0.6deg] data-[tilt=right]:rotate-[0.6deg] motion-reduce:rotate-0 upto-760:min-h-[26rem] upto-760:w-[84%] upto-760:shrink-0 upto-760:snap-center upto-760:rotate-0 upto-760:p-5";

export const yearStyles = {
  page: "px-gutter mx-auto max-w-[1040px] py-10 upto-760:py-6",
  // a comic page of two columns; on a phone, a row to swipe through
  grid: "mt-8 grid grid-cols-2 gap-x-7 gap-y-8 upto-760:-mx-gutter upto-760:mt-5 upto-760:flex upto-760:snap-x upto-760:snap-mandatory upto-760:gap-4 upto-760:overflow-x-auto upto-760:px-[8%] upto-760:pt-1 upto-760:pb-3 upto-760:[scrollbar-width:none]",
  // the opening panel: inked, speed lines behind Kenji and the title
  opening:
    "year-rays relative flex items-center justify-start gap-8 overflow-hidden border-[3px] border-line bg-ink p-7 text-paper shadow-[7px_7px_0_var(--accent)] upto-560:gap-4 upto-560:p-5 upto-560:[&_.mascot-spot]:w-20",
  title:
    "font-brand text-[clamp(2.6rem,9vw,5.5rem)] leading-[0.92] tracking-[0.02em] uppercase",
  titleHit:
    "inline-block -rotate-2 bg-paper px-3 text-ink shadow-[6px_6px_0_var(--accent)]",
  openingSmall: "mt-3 text-[0.95rem] text-paper/80",
  // the title the year gives them: the headline, inked in the spot colour
  titleCard: `${panel} col-span-full items-start justify-center bg-accent text-on-accent! border-line!`,
  titleKicker: "font-mono text-[0.8rem] tracking-[0.08em] uppercase opacity-90",
  titleName:
    "font-brand text-[clamp(3rem,10vw,6rem)] leading-[0.9] tracking-[0.02em] uppercase",
  titleLine: "max-w-[34ch] text-[1.15rem] font-medium",
  card: panel,
  cardWide: `${panel} col-span-full`,
  big: "font-brand text-[clamp(4rem,11vw,6.5rem)] leading-[0.9] tracking-[0.02em]",
  say: "text-[clamp(1.1rem,2.6vw,1.35rem)] font-semibold",
  small: "text-[0.98rem] leading-[1.45] opacity-85",
  heading:
    "font-brand text-[clamp(2.2rem,6vw,3.2rem)] leading-none tracking-[0.02em] uppercase",
  // Kenji in a corner, with a speech bubble
  kenji: "mb-auto flex items-start gap-2 self-start",
  kenjiFace: "printed mascot-spot m-0! w-12! shrink-0 p-1!",
  bubble:
    "relative mt-1 max-w-[22ch] rounded-[1.1rem] border-[2px] border-[var(--stamp-ink)] bg-card px-3 py-1.5 text-[0.88rem] leading-[1.3] font-semibold text-[var(--stamp-ink)] before:absolute before:top-3 before:-left-[7px] before:size-3 before:rotate-45 before:border-b-[2px] before:border-l-[2px] before:border-[var(--stamp-ink)] before:bg-card",
  // the fanned covers, a row of their own at the top right of a card
  covers: "mb-auto flex self-end pb-3",
  cover:
    "relative block aspect-[2/3] w-[4.4rem] overflow-hidden border-[2px] border-[var(--stamp-ink)] shadow-[3px_3px_0_var(--stamp-ink)] [&_img]:size-full [&_img]:object-cover [&:not(:first-child)]:-ml-6 nth-1:-rotate-6 nth-2:rotate-3 nth-3:rotate-8 upto-560:w-14",
  highlights: "mt-2 grid gap-2.5",
  highlightLabel:
    "font-mono text-[0.72rem] tracking-[0.06em] uppercase opacity-80",
  highlightText: "text-[1.05rem] leading-[1.3] font-semibold",
  // the dots under a phone's cards
  dots: "mt-1 hidden justify-center gap-1.5 upto-760:flex",
  dot: "size-2 rounded-full border-[1.5px] border-line data-[on]:bg-ink",
} as const;

// Tailwind classes for the "after the anime" pages: the list of shows
// (AfterAnimeIndex), one show (AfterAnimeShow) with a panel per season
// (SeasonPanel) and its correction form (FixForm). Cards, crumbs and empty
// states are the price pages' own (pages/Prices/styles.ts). Phones are
// upto-720.
export const afterAnimeStyles = {
  page: "prices-page flex flex-col gap-8",
  head: "flex flex-col gap-3",
  title:
    "max-w-[22ch] font-brand text-[clamp(2rem,5.4vw,3.4rem)] leading-[1.02] font-normal tracking-[0.02em] text-balance uppercase",
  // the series' name inked in, on however many lines it takes
  named: "bg-ink box-decoration-clone px-[0.14em] text-paper",
  sub: "max-w-[62ch] text-[1.05rem] text-ink-soft",

  // ---------- one season ----------
  seasons: "flex flex-col gap-6",
  // the words on the left, the volumes to get on the right; stacked on phones
  season:
    "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-5 border-3 border-line bg-card p-[clamp(1rem,2.6vw,1.6rem)] shadow-ink-lg upto-720:grid-cols-[minmax(0,1fr)]",
  seasonWords: "flex min-w-0 flex-col items-start gap-2",
  seasonTitle:
    "inline-block bg-[linear-gradient(var(--accent),var(--accent))] bg-size-[1.8em_3px] bg-left-bottom bg-no-repeat pb-[0.2rem] font-brand text-[1.3rem] font-normal tracking-[0.03em] uppercase",
  // the answer: what to start at
  start:
    "font-display text-[clamp(1.7rem,4.4vw,2.5rem)] leading-[1.08] font-semibold tracking-[-0.01em] text-balance",
  end: "max-w-[52ch] text-[1.02rem] text-ink-soft",
  note: "max-w-[52ch] text-[0.92rem] text-muted",
  corrected:
    "rounded-[2px] border border-line-soft px-[0.45rem] py-[0.05rem] text-[0.78rem] text-ink-soft",
  // the volumes to get, side by side
  // beside the words and the fix link on a laptop, between them on a phone
  volumes:
    "col-start-2 row-span-2 row-start-1 flex flex-col gap-3 upto-720:col-start-1 upto-720:row-span-1 upto-720:row-start-auto upto-720:w-full",
  volumeRow:
    "grid auto-cols-[128px] grid-flow-col justify-start gap-5 upto-720:auto-cols-[minmax(0,128px)] upto-720:gap-4",
  volumesNote: "max-w-[calc(128px*2+1.25rem)] text-[0.85rem] text-muted",
  volumeSkeleton: "aspect-2/3 w-[128px]",
  link: "tap w-fit font-medium underline decoration-accent decoration-2 underline-offset-3",

  // ---------- suggest a fix ----------
  // at the foot of the words' column
  fix: "col-start-1 self-end border-t border-dashed border-line-soft pt-3 [&[open]>summary]:mb-3",
  fixSummary:
    "tap w-fit cursor-pointer list-none text-[0.88rem] text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current [&::-webkit-details-marker]:hidden",
  fixForm:
    "grid max-w-[640px] grid-cols-2 gap-x-4 gap-y-3 upto-520:grid-cols-[minmax(0,1fr)]",
  fixField: "flex min-w-0 flex-col gap-[0.35rem]",
  fixWide: "col-span-full",
  fixLabel: "text-[0.9rem] font-semibold",
  fixHint: "font-normal text-muted",
  fixInput:
    "h-11 w-full rounded-[2px] border-[1.5px] border-line bg-paper px-[0.85rem] placeholder:text-muted placeholder:opacity-80 focus:bg-card focus:shadow-[3px_3px_0_var(--accent)] focus:outline-none",
  fixActions: "col-span-full flex flex-wrap items-center gap-3",
  fixProblem: "text-[0.9rem] text-accent-ink",
  fixThanks: "text-[0.95rem] text-ink-soft",

  // ---------- under the seasons ----------
  credit:
    "max-w-[70ch] text-[0.85rem] text-muted [&_a]:underline [&_a]:underline-offset-3",
  more: "flex flex-wrap items-center gap-3",
} as const;

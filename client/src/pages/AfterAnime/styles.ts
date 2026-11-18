// Tailwind classes for the "after the anime" pages: the list of shows
// (AfterAnimeIndex), one show (AfterAnimeShow) with a panel per season
// (SeasonPanel) and its correction form (FixForm). Cards, crumbs and empty
// states are the price pages' own (pages/Prices/styles.ts). Phones are
// upto-720.
export const afterAnimeStyles = {
  page: "prices-page flex flex-col gap-8",
  // The page's opening. On a laptop: what the page is, the answer and where
  // the anime stops on the left; the ticket to buy on the right, beside all
  // three. On a phone they're one column in the order they're written: the
  // title, the answer, the ticket, then the rest
  head: "grid grid-cols-[minmax(0,1fr)_minmax(0,25rem)] grid-rows-[auto_auto_1fr] items-start gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 upto-860:grid-cols-[minmax(0,1fr)] upto-860:grid-rows-none",
  // the answer to buy, in its own inked box: the latest season's volume,
  // its price and the way to a store, in the first screen at every size
  ticket:
    "col-start-2 row-span-3 row-start-1 flex flex-col gap-3 border-3 border-line bg-card p-[clamp(1rem,2.6vw,1.4rem)] shadow-ink-lg upto-860:col-start-1 upto-860:row-span-1 upto-860:row-start-auto upto-860:my-1",
  // under the answer: where the anime stops, what's worth knowing, and the
  // way to keep their place
  headRest: "flex min-w-0 flex-col items-start gap-2",
  track: "text-[0.95rem] text-ink-soft",

  // ---------- what's left after the anime ----------
  // a ruled strip under the opening: how much there is to catch up on and
  // what it costs, with the way to all of it
  left: "flex items-center justify-between gap-x-8 gap-y-3 border-t-3 border-line pt-4 upto-720:flex-col upto-720:items-stretch upto-720:[&_.btn]:justify-center",
  leftTitle:
    "font-brand text-[1.25rem] leading-tight font-normal tracking-[0.03em] uppercase",
  leftText: "mt-0.5 max-w-[62ch] text-[1rem] text-ink-soft",
  // "Watched less? Earlier seasons"
  earlier: "font-display text-[1.3rem] leading-tight font-semibold",

  // two lines: the series' name inked in, then what the page is for
  title:
    "flex max-w-[24ch] flex-col items-start gap-[0.14em] font-brand text-[clamp(2rem,5.4vw,3.4rem)] leading-[1.02] font-normal tracking-[0.02em] text-balance uppercase",
  // the name, on however many lines it takes
  named: "bg-ink box-decoration-clone px-[0.14em] text-paper",
  sub: "max-w-[62ch] text-[1.05rem] text-ink-soft",

  // the answer for the latest season, said before anything else: a
  // question, then what to do on its own line, big; where the anime stops is
  // the quieter line under them (sub)
  lead: "max-w-[34ch] font-display text-[clamp(1.4rem,3.2vw,1.9rem)] leading-[1.2] font-semibold text-balance text-ink",
  // the question, in blue: what's asked and which season are one colour,
  // the answers (chapter, volume) another, so each is found at a glance
  leadAsked: "block font-normal text-asked",

  // ---------- every season at a glance ----------
  // a long season name wraps; the chapter and the volume never do
  tableWrap: "overflow-x-auto border-2 border-line bg-card shadow-ink",
  table:
    "w-full border-collapse text-left text-[0.95rem] tabular-nums [&_a]:underline [&_a]:decoration-accent [&_a]:decoration-2 [&_a]:underline-offset-3 [&_tbody_th]:font-semibold [&_tbody_tr]:border-t [&_tbody_tr]:border-dashed [&_tbody_tr]:border-line-soft [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2.5 [&_thead_th]:bg-paper-2 [&_thead_th]:text-[0.8rem] [&_thead_th]:font-medium [&_thead_th]:text-ink-soft [&_td]:whitespace-nowrap upto-520:text-[0.8rem] upto-520:[&_td]:px-2 upto-520:[&_th]:px-2",

  // ---------- one season ----------
  seasons: "flex flex-col gap-6",
  // the words on the left, the volumes to buy on the right; stacked on phones.
  // A link from the table lands with room above it
  season:
    "grid scroll-mt-6 grid-cols-[minmax(0,1fr)_minmax(0,25rem)] items-start gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-5 border-3 border-line bg-card p-[clamp(1rem,2.6vw,1.6rem)] shadow-ink-lg upto-860:grid-cols-[minmax(0,1fr)]",
  seasonWords: "flex min-w-0 flex-col items-start gap-2",
  seasonHeading: "flex flex-col items-start gap-2",
  seasonTitle:
    "inline-block bg-[linear-gradient(var(--asked),var(--asked))] bg-size-[1.8em_3px] bg-left-bottom bg-no-repeat pb-[0.2rem] font-brand text-[1.3rem] font-normal tracking-[0.03em] text-asked uppercase",
  // the answer: what to start at
  start:
    "font-display text-[clamp(1.7rem,4.4vw,2.5rem)] leading-[1.08] font-semibold tracking-[-0.01em] text-balance",
  // the chapter or volume in a line of the answer, in the accent colour
  // (AnswerWords.tsx)
  startAnswer: "text-accent",
  end: "max-w-[52ch] text-[1.02rem] text-ink-soft",
  note: "max-w-[52ch] text-[0.92rem] text-muted",
  corrected:
    "rounded-[2px] border border-line-soft px-[0.45rem] py-[0.05rem] text-[0.78rem] text-ink-soft",
  // beside the words and the fix link on a laptop, between them on a phone
  volumes:
    "col-start-2 row-span-2 row-start-1 flex flex-col gap-3 upto-860:col-start-1 upto-860:row-span-1 upto-860:row-start-auto",
  volumesNote: "text-[0.85rem] text-muted",

  // ---------- a volume to buy ----------
  buyList: "flex flex-col gap-4",
  buy: "grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-4",
  // the cover over what shows when there's none (Prices' CoverFallback, its
  // number sized down for this small cover)
  buyCover:
    "[&>span]:text-[1.6rem] relative block aspect-2/3 overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-ink [&>img]:relative [&>img]:size-full [&>img]:object-cover",
  buyWords: "flex min-w-0 flex-col items-start gap-[0.2rem]",
  // which volume to buy: the thing they came for, so it's said large
  buyTitle:
    "font-display text-[1.5rem] leading-tight font-semibold text-accent",
  buyWhy: "text-[0.88rem] text-ink-soft",
  // the price, large: what a buyer looks for first. Larger still in the
  // page's ticket (buyPriceLead)
  buyPrice:
    "mt-1 flex flex-wrap items-baseline gap-x-2 text-[1rem] text-ink [&_strong]:font-mono [&_strong]:text-[1.45rem] [&_strong]:leading-none [&_strong]:font-semibold [&_strong]:tracking-[-0.02em]",
  buyPriceLead: "[&_strong]:text-[1.9rem]!",
  // the button on its own line (full width on a phone), then the other
  // ways in
  buyActions:
    "mt-2 flex w-full flex-col items-start gap-2 upto-720:items-stretch upto-720:[&_.btn]:justify-center",
  // a cheaper used copy and every store: links, not buttons, so one button
  // leads
  buyOthers:
    "flex flex-wrap gap-x-4 gap-y-1 text-[0.9rem] [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-accent [&_a]:decoration-2 [&_a]:underline-offset-3 upto-720:[&_a]:py-1",
  // last: nothing between the price and the button
  buyChecked: "text-[0.8rem] text-muted",
  buySkeleton: "h-28",
  link: "tap w-fit text-[0.92rem] font-medium underline decoration-accent decoration-2 underline-offset-3",

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

  // ---------- the bar on a series' price page ----------
  // quieter than the cost slip under it: dashed, no shadow, and close to it.
  // On a phone it's one short row: the question and a small button, with
  // the sentence left out (the button says where it leads)
  bar: "-mb-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-2 border-dashed border-line bg-paper-2 px-5 py-3 upto-520:flex-nowrap upto-520:gap-x-3 upto-520:px-3 upto-520:py-2 upto-520:[&>.btn]:h-9 upto-520:[&>.btn]:shrink-0 upto-520:[&>.btn]:px-3 upto-520:[&>.btn]:text-[0.875rem]",
  barWords: "flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1",
  barTitle:
    "font-brand text-[1.3rem] leading-none font-normal tracking-[0.03em] uppercase upto-520:text-[1.15rem]",
  barText: "text-[0.98rem] text-ink-soft upto-520:hidden",

  // ---------- the add form's "watched the anime?" row ----------
  watched: "flex flex-wrap items-center gap-2 text-[0.88rem] text-ink-soft",
  watchedPick:
    "tap min-h-9 rounded-[2px] border-[1.5px] border-line-soft bg-paper px-[0.65rem] text-[0.85rem] font-medium text-ink-soft transition-[color,border-color,background-color] duration-120 ease-[ease] hover:border-line hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent focus-visible:outline-dashed aria-pressed:border-line aria-pressed:bg-ink aria-pressed:text-paper",

  // ---------- the owner's review page ----------
  reviewList: "flex flex-col gap-4",
  reviewItem:
    "flex flex-col gap-2 border-[1.5px] border-line bg-card p-4 shadow-ink",
  reviewName: "text-[1.05rem] font-semibold",
  reviewFacts:
    "text-[0.95rem] text-ink-soft [&_b]:font-semibold [&_b]:text-ink",
  reviewSource: "text-[0.9rem] wrap-anywhere underline underline-offset-3",
  reviewActions: "mt-1 flex flex-wrap items-center gap-3",
  reviewDecided: "text-[0.9rem] text-muted",

  // an answer's short lines, one a season
  answerList: "mt-2 flex list-none flex-col gap-1 tabular-nums",

  // ---------- under the seasons ----------
  // the whole run in one buy, when a box set is priced
  boxSet:
    "max-w-[62ch] text-[1rem] text-ink-soft [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-accent [&_a]:decoration-2 [&_a]:underline-offset-3 [&_strong]:font-mono [&_strong]:font-semibold [&_strong]:text-ink",
  credit:
    "flex max-w-[70ch] list-none flex-col gap-1 text-[0.85rem] text-muted [&_a]:underline [&_a]:underline-offset-3",
  more: "flex flex-wrap items-center gap-3",
} as const;

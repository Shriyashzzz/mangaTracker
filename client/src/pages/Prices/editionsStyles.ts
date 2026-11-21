// The editions lookup (EditionFinder.tsx), the book tiles (BookTiles.tsx)
// and the /editions page (EditionsIndex.tsx)
import { formStyles } from "../../styles/form";

export const editionsStyles = {
  // "Which book has volume [23]?": a ticket on card paper, the question
  // with its box, then one answer a line, one line an edition
  finder:
    "flex flex-col gap-3 border-2 border-line bg-card px-5 py-4 shadow-ink upto-520:px-4",
  ask: "flex flex-wrap items-center gap-x-3 gap-y-2",
  askLabel:
    "font-brand text-[1.3rem] leading-none tracking-[0.03em] text-ink uppercase",
  askInput: `${formStyles.input} w-24! font-mono text-[1.05rem]`,
  askNote: "font-mono text-[0.78rem] text-muted",
  answers: "flex flex-col gap-1.5",
  answer: "flex flex-wrap items-baseline gap-x-2 text-[1rem]",
  answerBook: "font-semibold text-accent",
  answerInside: "font-mono text-[0.85rem] text-ink-soft",
  answerNone: "text-[0.95rem] text-ink-soft",
  // a book confirmed but not out yet
  answerComing: "font-mono text-[0.8rem] text-muted",
  // a line's books as tiles: the number big, what it holds under it
  lineHead:
    "mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5",
  lineName:
    "font-brand text-[1.15rem] leading-none tracking-[0.04em] text-accent uppercase",
  // the line's facts, the main data: in the accent too, and a size and a
  // weight up on a wide screen, where the phone's size reads thin
  lineFacts:
    "font-mono text-[0.76rem] text-accent md:text-[0.88rem] md:font-medium",
  tiles: "grid grid-cols-[repeat(auto-fill,minmax(3.6rem,1fr))] gap-2",
  tile: "flex flex-col items-center border-[1.5px] border-line bg-card px-1 pt-1.5 pb-1 text-center shadow-ink",
  // the book the lookup answered with: the accent's frame
  tileAnswer: "outline-2 outline-offset-2 outline-accent",
  // a book whose volumes they own every one of: inked in
  tileOwned: "bg-ink text-paper [&_small]:text-paper/80",
  // confirmed and coming: dashed, flat, with its date
  tileComing: "border-dashed bg-transparent shadow-none",
  tileDate: "mt-0.5 font-mono text-[0.62rem] whitespace-nowrap text-muted",
  tileNumber: "font-brand text-[1.45rem] leading-none",
  tileInside: "mt-0.5 font-mono text-[0.68rem] whitespace-nowrap text-ink-soft",
  tilesKey: "mt-2 font-mono text-[0.72rem] text-muted",
  // the page
  list: "flex flex-col",
  letter:
    "mt-6 border-b-[3px] border-double border-line pb-1 font-brand text-[1.8rem] leading-none text-accent first:mt-0",
  series: "border-b border-dashed border-line-soft",
  seriesSummary:
    "tap flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden",
  cover:
    "relative aspect-[2/3] w-11 shrink-0 overflow-hidden border-[1.5px] border-line bg-paper-2",
  seriesName:
    "min-w-0 flex-1 font-display text-[1.15rem] leading-tight font-semibold",
  seriesLines:
    "shrink-0 text-right font-mono text-[0.74rem] leading-snug text-accent md:text-[0.88rem] md:font-medium",
  seriesBody: "flex flex-col gap-5 pb-5 pl-14 upto-520:pl-0",
  seriesLinks: "flex flex-wrap gap-x-5 gap-y-1 text-[0.9rem] font-medium",
  // one series opened from the search
  // the cover beside the lookup
  pickedHead: "flex items-start gap-4 upto-520:gap-3",
  pickedCover:
    "relative aspect-[2/3] w-24 shrink-0 overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-ink upto-520:w-16",
  pickedName: "font-display text-[1.6rem] leading-tight font-semibold",
  pickedLines: "flex flex-col gap-6",
  textLink:
    "tap underline decoration-line-soft underline-offset-3 hover:decoration-current",
} as const;

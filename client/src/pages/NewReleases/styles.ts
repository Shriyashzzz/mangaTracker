// Tailwind classes for the page that explains the New tab, and its controls.

const heading =
  "font-brand text-[clamp(1.6rem,4vw,2rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase";

export const newReleasesStyles = {
  page: "mx-auto flex max-w-[720px] flex-col gap-[clamp(2rem,5vw,3rem)]",
  head: "flex items-end justify-between gap-4",
  titleBlock: "flex min-w-0 flex-col gap-2.5",
  // under the title: who it's for, in the body face, quieter than the lead
  tagline:
    "max-w-[44ch] text-[clamp(0.95rem,2.4vw,1.05rem)] leading-[1.45] text-ink-soft",
  title:
    "font-brand text-[clamp(2.8rem,7vw,4.4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  // ink on paper in every theme; the dark theme would otherwise turn his face black
  kenji:
    "printed block aspect-square w-[110px] shrink-0 overflow-hidden rounded-full border-[2.5px] border-line bg-card px-2.5 pt-2.5 upto-760:w-[76px] upto-760:px-1.5 upto-760:pt-1.5",
  // the lead, close under the title
  intro: "-mt-2 flex flex-col gap-2",
  lead: "max-w-[50ch] text-[clamp(1.15rem,3vw,1.35rem)] leading-[1.45] text-ink",
  sub: "max-w-[55ch] text-[1.02rem] leading-[1.5] text-ink-soft",
  // each section is a panel of its own, inked like the strip's
  section:
    "flex flex-col gap-3 border-2 border-line bg-card p-[clamp(1rem,3vw,1.5rem)] shadow-ink-lg [&_p]:max-w-[65ch] [&_p]:leading-[1.55] [&_p]:text-ink-soft",
  // the settings: unframed, as the controls bring their own box
  sectionPlain:
    "flex flex-col gap-3 [&_p]:max-w-[65ch] [&_p]:leading-[1.55] [&_p]:text-ink-soft",
  // what New does by default: a line, then one list a line
  defaults:
    "flex flex-col gap-1.5 [&_b]:font-semibold [&_b]:text-ink [&_li]:leading-[1.5] [&_li]:text-ink-soft [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5 [&_ul]:marker:text-line-soft",
  // a second thought in an answer, on a line of its own
  nextLine: "mt-1.5 block",
  heading,
  sources: "flex flex-col border-b-[1.5px] border-line",
  source:
    "grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-6 gap-y-1 border-t-[1.5px] border-line py-3 upto-520:grid-cols-[minmax(0,1fr)]",

  // ---------- the strip: the idea in three panels ----------
  // Read left to right, on a phone too (three narrow panels, like a strip
  // in a magazine): each an inked panel with its number on a corner tab, a
  // drawing that fills it, and a line of words. An arrow leads from one
  // panel to the next
  // the change link and the strip under it, close together
  stripGroup: "flex flex-col gap-3",
  strip:
    "grid grid-cols-3 gap-5 upto-520:gap-2.5 [&>li+li]:before:absolute [&>li+li]:before:top-1/2 [&>li+li]:before:-left-[1.3rem] [&>li+li]:before:-translate-y-1/2 [&>li+li]:before:text-[1.35rem] [&>li+li]:before:leading-none [&>li+li]:before:font-semibold [&>li+li]:before:text-ink [&>li+li]:before:content-['→'] upto-520:[&>li+li]:before:hidden",
  panelBox:
    "relative flex flex-col items-center gap-3 border-2 border-line bg-card px-3 pt-9 pb-4 text-center shadow-ink-lg [&_p]:text-[1.05rem] [&_p]:leading-[1.3] [&_p]:font-semibold [&_p]:text-ink upto-520:px-1.5 upto-520:pt-8 upto-520:pb-3 upto-520:[&_p]:text-[0.86rem]",
  panelNumber:
    "absolute top-0 left-0 bg-ink pt-[0.2rem] pr-3.5 pb-[0.1rem] pl-2.5 font-brand text-[1.3rem] leading-none text-paper [clip-path:polygon(0_0,100%_0,calc(100%-7px)_100%,0_100%)]",
  // every panel's drawing is the same height, so the words line up
  panelArt:
    "flex h-[7.5rem] flex-col items-center justify-center gap-2 upto-520:h-[6.5rem]",
  // a volume, drawn big: the placeholder cover with its number
  book: "cover-lines relative grid aspect-2/3 w-[4.25rem] place-items-center border-2 border-line bg-paper-2 font-brand text-[1.9rem] leading-none text-ink shadow-ink upto-520:w-[3.4rem] upto-520:text-[1.5rem]",
  yours:
    "flex items-center gap-1 text-[0.82rem] font-semibold text-ink [&_svg]:text-accent",
  // "Out!", stamped across the book's top corner, clear of its number
  stamp:
    "absolute -top-3 -right-7 rotate-8 rounded-[3px] border-2 border-accent bg-paper px-2 font-brand text-[1.15rem] leading-[1.3] tracking-[1px] text-accent uppercase upto-520:-right-5 upto-520:px-1.5 upto-520:text-[0.95rem]",
  // the New tab's own words, as the tab says them
  newTab:
    "flex items-center gap-2 font-brand text-[1.7rem] leading-none tracking-[0.03em] text-ink uppercase upto-520:text-[1.35rem] [&_small]:rounded-[3px] [&_small]:bg-accent [&_small]:px-1.5 [&_small]:py-0.5 [&_small]:font-mono [&_small]:text-[0.75rem] [&_small]:text-on-accent",
  news: "font-brand text-[1.35rem] leading-[1.1] tracking-[0.04em] text-accent uppercase upto-520:text-[1.05rem]",

  // a link inside an answer: the page's own setting, further down
  link: "font-semibold text-ink underline decoration-accent decoration-2 underline-offset-3 hover:text-accent",
  // a New card drawn under an answer (CardSketch): the row below at
  // its real size, set off from the words above it
  sketch: "mt-2.5 flex max-w-[26rem] flex-col gap-1.5 select-none",
  sketchBehind: "text-ink-soft",
  sketchYours: "text-[0.84rem] text-ink-soft",
  // the line a tapped chapter card opens with, as its list says it
  sketchOpens:
    "self-start border-[1.5px] border-dashed border-line-soft bg-card px-3 py-1.5 text-[0.84rem] text-ink-soft",
  // the piles, drawn (PilesPicture): the shelf's own pile styles
  pilesPicture: "flex flex-col",
  // the three questions: each asked in the lettering, answered beside it
  questions:
    "flex flex-col border-2 border-line bg-card px-[clamp(1rem,3vw,1.5rem)] py-1 shadow-ink-lg [&>div:first-child]:border-t-0 [&>div]:border-line-soft",
  question:
    "grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-6 gap-y-0.5 border-t-[1.5px] border-line py-3 upto-520:grid-cols-[minmax(0,1fr)] [&_dd]:leading-[1.5] [&_dd]:text-ink-soft [&_dd_b]:font-semibold [&_dd_b]:text-ink [&_dt]:font-brand [&_dt]:text-[1.2rem] [&_dt]:leading-[1.15] [&_dt]:tracking-[0.02em] [&_dt]:uppercase",

  // the settings' choices, shown to a visitor with no shelf: drawn as the
  // radio buttons they are there, so they read as options to pick from
  choices: "flex flex-col gap-2",
  choice:
    "flex flex-col gap-0.5 border-[1.5px] border-line-soft bg-card px-3.5 py-2.5",
  // (no radio drawn beside the name: these are examples, not controls)
  choiceName: "font-medium text-ink",
  choiceNote: "text-[0.88rem] text-muted",
  choiceShows:
    "text-[0.92rem] text-ink-soft [&_b]:font-semibold [&_b]:text-ink",

  // "More about New": folded, for anyone who wants the rest
  more: "border-2 border-line bg-card px-[clamp(1rem,3vw,1.5rem)] py-3 shadow-ink-lg",
  moreSummary:
    "tap cursor-pointer font-brand text-[1.3rem] tracking-[0.02em] uppercase marker:text-ink-soft",
  moreBody: "mt-5 flex flex-col gap-[clamp(1.5rem,4vw,2.25rem)]",

  // ---------- a New card, drawn (CardSketch) ----------
  // one series: its book, its words, and what can be done about it
  picRow:
    "flex items-center gap-3 border-[1.5px] border-line-soft bg-card px-3 py-2.5",
  // a volume, drawn: the placeholder cover with its number
  picBook:
    "cover-lines grid aspect-2/3 w-10 flex-none place-items-center border-[1.5px] border-line bg-paper-2 font-brand text-[1.1rem] text-ink shadow-ink",
  picWords:
    "flex min-w-0 flex-1 flex-col gap-0.5 [&_b]:truncate [&_b]:font-display [&_b]:text-[1.02rem] [&_b]:leading-[1.2] [&_b]:font-semibold [&_b]:text-ink",
  picNews:
    "font-brand text-[1.1rem] leading-none tracking-[0.04em] text-accent uppercase",
  picHide:
    "flex flex-none items-center gap-1 text-[0.88rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3",
  // where the news comes from: smaller, at the foot of the page
  finePrint:
    "flex flex-col gap-2 border-t-[1.5px] border-line-soft pt-4 text-[0.88rem] leading-[1.5] text-muted [&_li]:max-w-[70ch] [&_p]:max-w-[70ch] [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5",
  smallHeading:
    "font-mono text-[0.8rem] font-medium tracking-[0.04em] text-ink-soft uppercase",

  // the controls
  panel:
    "printed flex flex-col gap-6 border-3 border-line bg-paper p-[clamp(1.25rem,3vw,1.75rem)] text-ink",
  group: "flex flex-col gap-1 border-0 p-0",
  legend:
    "mb-1 font-brand text-[1.3rem] leading-[1.1] tracking-[0.02em] uppercase",
  groupNote: "mb-1 text-[0.9rem] text-ink-soft",
  option:
    "flex min-h-11 cursor-pointer items-center gap-3 [&_input]:size-[18px] [&_input]:shrink-0 [&_input]:accent-[var(--accent)]",
  // the slider, then what it's set to in words under it on a phone
  sliderRow:
    "ml-[30px] flex items-center gap-x-3 pb-1 upto-520:flex-col upto-520:items-stretch",
  slider:
    // (not flex-1 on a phone: stacked in a column it shrank to 16px tall)
    "h-11 min-w-0 flex-1 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 upto-520:flex-none",
  sliderValue: "w-44 shrink-0 text-[0.92rem] font-medium upto-520:w-auto",
  // the example under a choice: "If vol. 30 is the newest:", then a row
  // per case lined up in columns, what you have → what New does
  example:
    "mt-1 flex flex-col gap-1.5 rounded-ink bg-accent-wash px-3 py-2.5 text-[0.92rem] text-ink",
  exampleNewest: "text-ink-soft",
  exampleRows:
    "grid grid-cols-[max-content_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1",
  exampleRow: "contents",
  exampleArrow: "size-4 text-ink-soft",
  exampleThen: "font-medium whitespace-nowrap",
  status: "min-h-6 text-[0.9rem] font-medium text-ink-soft",
  failed: "min-h-6 text-[0.9rem] font-medium text-accent",
} as const;

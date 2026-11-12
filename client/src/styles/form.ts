// Tailwind classes for the add and edit manga forms (AddManga, UpdateManga).
// Sized so the whole form sits in one laptop viewport without scrolling;
// short laptop screens (short-laptop) tuck the pitch line away, phones
// (upto-760) stack everything in one column.

// a text field's look; textarea and select build on it
const input =
  "h-11 w-full rounded-[2px] border-[1.5px] border-line bg-paper px-[0.85rem] transition-[box-shadow,background-color] duration-120 ease-[ease] placeholder:text-muted placeholder:opacity-80 focus:bg-card focus:shadow-[3px_3px_0_var(--accent)] focus:outline-none";

// the label above a field; <b> is the required star
const label = "text-[0.9rem] font-semibold [&_b]:text-accent";

export const formStyles = {
  page: "mx-auto max-w-[900px] upto-760:mt-0",
  // back link + title on the left, the one-line pitch on the right
  pageHead:
    "mb-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 short-laptop:mb-[0.85rem] short-laptop:[&>div]:flex short-laptop:[&>div]:items-baseline short-laptop:[&>div]:gap-5",
  backLink:
    "tap mb-[0.15rem] inline-block text-[0.85rem] text-muted underline-offset-3 hover:text-ink hover:underline short-laptop:mb-0",
  formTitle:
    "font-brand font-normal uppercase tracking-[0.02em] text-[clamp(1.9rem,3.4vw,2.3rem)] leading-[1.05] font-medium",
  formSub:
    "max-w-sm text-[0.95rem] leading-[1.45] text-balance text-ink-soft short-laptop:hidden",

  // one sheet: the cover column beside the details. The title comes first
  // in the markup (it's what you type first, and it drives the cover
  // lookup); on phones it's title, then the cover row, then the rest
  // the Add page: its title sits in the box's top border (caption), so the
  // box starts lower and leaves room under the caption. The caption is as
  // tall as its row and centred on the border, so the title's background is
  // the page above the line and the box below it: the line just stops
  sheetCaptioned: "relative mt-5 pt-[clamp(1.9rem,3.5vw,2.3rem)]",
  caption:
    "pointer-events-none absolute inset-x-[clamp(0.75rem,2vw,1.25rem)] -top-[1.15rem] flex h-[2.3rem] items-center justify-between gap-4 [&>*]:pointer-events-auto",
  captionTitle:
    "bg-[linear-gradient(var(--color-paper)_50%,var(--color-card)_50%)] px-2.5 font-brand text-[clamp(1.6rem,3vw,2rem)] leading-[1.1] font-normal tracking-[0.02em] uppercase",
  captionBack:
    "tap flex h-9 items-center gap-1 border-[1.5px] border-line bg-card pr-3 pl-2 text-[0.9rem] font-medium text-ink transition-colors duration-150 hover:bg-[linear-gradient(var(--accent-wash),var(--accent-wash)),linear-gradient(var(--color-card),var(--color-card))] [&_svg]:size-4",
  sheet:
    "grid grid-cols-[172px_minmax(0,1fr)] grid-rows-[auto_1fr] gap-x-9 gap-y-[0.95rem] border-[1.5px] border-line bg-card p-[clamp(1.1rem,2.5vw,1.5rem)] shadow-[6px_6px_0_var(--hard-shadow)] upto-760:grid-cols-[minmax(0,1fr)] upto-760:grid-rows-none upto-760:gap-5",
  coverArea:
    "col-start-1 row-span-2 row-start-1 upto-760:row-span-1 upto-760:row-start-2",
  titleField: "col-start-2 row-start-1 upto-760:col-start-1",
  // the title box and AniList's guesses dropping down from it
  titleCombo: "relative",
  titleComboNote:
    "mt-1 border-t border-dashed border-line-soft px-[0.55rem] pt-[0.45rem] pb-[0.2rem] text-[0.85rem] text-ink-soft",
  // the add page: one column, the title search first and the rest under it
  // once a series is chosen
  addPage: "mx-auto max-w-[720px] upto-760:mt-0",
  addSheet:
    "flex flex-col gap-6 border-[1.5px] border-line bg-card px-[clamp(1rem,3.5vw,2rem)] pb-[clamp(1.1rem,3vw,1.75rem)] shadow-[6px_6px_0_var(--hard-shadow)]",
  titleSearchIcon:
    "pointer-events-none absolute top-[1.7rem] left-3.5 z-1 size-[18px] -translate-y-1/2 text-muted",
  titleSearch: "h-[3.4rem] scroll-mt-24 pl-11 text-[1.1rem]",
  // AniList's matches: the list scrolls, its foot (as typed) stays put. The
  // height cuts a row in half, so it's plain there are more below
  titleList:
    "absolute inset-x-0 top-[calc(100%+6px)] z-15 flex max-h-[min(22rem,55dvh)] flex-col border-[1.5px] border-line bg-card shadow-[4px_4px_0_var(--hard-shadow)] [&>ul]:min-h-0 [&>ul]:overflow-y-auto [&>ul]:p-[0.35rem] [&>ul]:[scrollbar-color:var(--line-soft)_transparent] [&>ul]:[scrollbar-width:thin]",
  titleOption: "min-h-12 cursor-pointer",
  titleTag:
    "ml-2 border border-line-soft px-1 text-[0.68rem] whitespace-nowrap text-ink-soft",
  titleListFoot:
    "flex items-center justify-between gap-3 border-t-[1.5px] border-line-soft px-3",
  titleTyped:
    "tap ml-auto min-h-11 text-right text-[0.88rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  hint: "text-[0.88rem] text-muted",
  // the title is on their shelf already: said plainly, with the way to it
  alreadyNote:
    "border-l-[3px] border-accent bg-accent-wash px-3 py-2 text-[0.92rem] text-ink",
  // the series once chosen: its cover, name and what's known, with the ways
  // to change it
  picked:
    "grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 border-[1.5px] border-line-soft bg-paper p-3 upto-480:grid-cols-[56px_minmax(0,1fr)] upto-480:gap-3",
  pickedCover:
    "aspect-2/3 w-full overflow-hidden border-[1.5px] border-line bg-paper-2 [&_img]:size-full [&_img]:object-cover",
  pickedBlank:
    "grid aspect-2/3 w-full place-items-center border-[1.5px] border-dashed border-line-soft p-1 text-center font-hand text-[0.95rem] leading-[1.05] text-muted",
  pickedName:
    "font-brand text-[clamp(1.4rem,3vw,1.75rem)] leading-none font-normal tracking-[0.02em] break-words uppercase",
  pickedMeta: "mt-1 text-[0.84rem] text-muted",
  pickedActs: "mt-0.5 flex flex-wrap gap-x-4",
  textLink:
    "tap inline-flex min-h-9 items-center gap-1.5 text-[0.86rem] upto-760:min-h-11 font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current [&_svg]:size-4",
  linkRow: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
  // "More about it": everything optional, folded until they want it
  more: "group/more border-[1.5px] border-line-soft bg-paper open:[&>summary]:border-b open:[&>summary]:border-line-soft",
  moreSummary:
    "flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 px-3.5 py-2 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent focus-visible:outline-dashed [&::-webkit-details-marker]:hidden",
  moreTitle:
    "font-brand text-[1.2rem] leading-none tracking-[0.04em] whitespace-nowrap uppercase",
  // on small phones the summary sits under the title, full width
  moreSub:
    "min-w-0 flex-1 text-[0.84rem] text-muted upto-480:order-last upto-480:basis-full",
  moreArrow:
    "ml-auto grid size-8 shrink-0 place-items-center border-[1.5px] border-line bg-card transition-transform duration-200 ease-out group-open/more:rotate-180 motion-reduce:transition-none [&_svg]:size-4",
  moreBody: "flex flex-col gap-5 px-3.5 pt-4 pb-5",
  chapterField: "flex min-w-0 flex-col gap-[0.35rem]",
  statusRow:
    "grid grid-cols-[minmax(0,1fr)_15rem] items-end gap-5 upto-760:grid-cols-1",
  statusAlone: "grid",
  addActions:
    "flex items-center justify-end gap-4 upto-480:flex-col-reverse upto-480:items-stretch",
  details:
    "col-start-2 row-start-2 flex min-w-0 flex-col gap-[0.95rem] upto-760:col-start-1 upto-760:row-start-3",
  // notes soak up whatever height is left so both columns end together
  notesField: "flex-1",
  labelRow: "flex items-baseline justify-between",
  counter: "font-mono text-[0.75rem] text-muted",
  // chapter, volumes and genre side by side; stacked on small phones so
  // long genres fit
  row: "grid auto-cols-[minmax(0,1fr)] grid-flow-col items-end gap-5 upto-480:grid-flow-row",

  field: "flex min-w-0 flex-col gap-[0.35rem]",
  label,
  fieldLabel: label,
  optional: "text-[0.82rem] font-normal text-muted",
  // "You're on [Chapter|Volume]": the label with a small switch for what the
  // box counts. The radios are hidden; the checked one's label is inked in,
  // as the status tickets are
  unitRow: "flex flex-wrap items-center justify-between gap-x-3 gap-y-1",
  unitSwitch:
    "inline-flex overflow-hidden rounded-[2px] border-[1.5px] border-line [&>input]:pointer-events-none [&>input]:absolute [&>input]:opacity-0",
  unitLabel:
    "flex h-8 cursor-pointer items-center px-3 text-[0.82rem] font-medium text-ink-soft transition-[color,background-color] duration-120 ease-[ease] hover:text-ink [input:checked+&]:bg-ink [input:checked+&]:text-paper [input:focus-visible+&]:outline-2 [input:focus-visible+&]:-outline-offset-2 [input:focus-visible+&]:outline-accent [input:focus-visible+&]:outline-dashed",

  input,
  textarea: `${input} h-auto min-h-16 flex-1 resize-y px-[0.85rem] py-[0.7rem] leading-[1.6]`,
  select: `${input} select-chevron cursor-pointer pr-[2.2rem]`,

  // status choice: radio "tickets". The radios are hidden; each label after
  // a checked radio is inked in. The others are plain paper with a solid
  // edge, so they read as choices rather than disabled
  segmented:
    "flex gap-3 [&>input]:pointer-events-none [&>input]:absolute [&>input]:opacity-0",
  segmentLabel:
    "flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[2px] border-[1.5px] border-line-soft bg-paper px-2 text-center text-[0.92rem] upto-480:px-0.5 upto-480:text-[0.86rem] leading-tight font-medium text-ink-soft transition-[color,border-color,background-color] duration-120 ease-[ease] hover:border-line hover:text-ink [input:checked+&]:border-line [input:checked+&]:bg-ink [input:checked+&]:text-paper [input:focus-visible+&]:outline-2 [input:focus-visible+&]:outline-offset-3 [input:focus-visible+&]:outline-accent [input:focus-visible+&]:outline-dashed",

  // under the field it's about, in the app's own words
  fieldError: "text-[0.85rem] font-medium text-accent",
  invalid:
    "border-accent! shadow-[3px_3px_0_var(--accent-wash)] focus:shadow-[3px_3px_0_var(--accent)]",

  errorList:
    "flex flex-col gap-1 border-[1.5px] border-accent bg-accent-wash px-[0.95rem] py-[0.7rem] text-[0.9rem] text-accent",
  btnContainer:
    "mt-auto flex items-center justify-end gap-4 upto-480:flex-col-reverse upto-480:items-stretch",
} as const;

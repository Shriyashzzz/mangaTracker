// Tailwind classes for one manga's page (Details) and its buy box (BuyStrip).
// Every manga gets the same two columns whatever it has to show: cover and Buy it
// on the left, everything else on the right. Phones (upto-720) unpack both columns
// into one list: a small cover beside the title, the red bar, your copy, then
// Buy it. The DOM follows the laptop's reading order, and `order` does the rest.

// a small ink tag under the title (status, genre)
const tag =
  "rounded-[2px] border-[1.5px] px-[0.55rem] py-[0.12rem] text-[0.8rem] font-medium";

// the shape shared by the buy tickets and the "caught up" note
const ticket =
  "flex min-h-10 items-baseline gap-[0.45rem] rounded-ink border-[1.5px] px-3 py-[0.45rem] text-[0.92rem]";

export const detailsStyles = {
  backLink:
    "tap mb-8 inline-block text-[0.9rem] text-muted underline-offset-3 hover:text-ink hover:underline",

  layout:
    "grid grid-cols-[240px_minmax(0,1fr)] items-start gap-x-[clamp(2rem,4vw,3rem)] upto-980:grid-cols-[200px_minmax(0,1fr)] upto-720:grid-cols-[90px_minmax(0,1fr)] upto-720:gap-x-3.5 upto-720:gap-y-4",
  main: "col-start-2 row-start-1 flex min-w-0 flex-col gap-4 upto-720:contents",
  side: "col-start-1 row-start-1 flex min-w-0 flex-col gap-[1.4rem] upto-720:contents",
  cover:
    "relative aspect-2/3 w-full upto-720:order-first [&_img]:size-full [&_img]:border-[1.5px] [&_img]:border-line [&_img]:bg-paper-2 [&_img]:object-cover [&_img]:shadow-[6px_6px_0_var(--hard-shadow)] upto-720:[&_img]:shadow-ink-lg",
  // the cover drawn from the name, framed like the image would be
  drawnCover:
    "border-[1.5px] border-line shadow-[6px_6px_0_var(--hard-shadow)] upto-720:shadow-ink-lg",
  // the real cover leans a little; its loading skeleton doesn't
  coverTilt: "-rotate-[1.2deg] upto-720:rotate-0",
  // hanko-style "Done" stamp
  stamp:
    "absolute top-3.5 -right-3 rotate-12 rounded-[4px] border-[2.5px] border-accent bg-paper px-[0.6rem] py-[0.15rem] font-brand text-[1.35rem] tracking-[2px] text-accent upto-720:top-1.5 upto-720:-right-2 upto-720:border-2 upto-720:px-[0.3rem] upto-720:py-0 upto-720:text-[0.85rem]",

  // the title, and their volumes on a shelf beside it. Under it below 1100px,
  // where beside it would squeeze the title; on phones, its own row under the cover and title
  titleRow:
    "flex items-end justify-between gap-x-8 gap-y-5 max-[1099px]:flex-col max-[1099px]:items-stretch upto-720:contents",
  // under the shelf: "9 of 113", halves and specials, and how it works
  // until they've tried it
  shelfCaption:
    "mt-1.5 flex flex-wrap justify-between gap-x-4 font-mono text-[0.8rem] text-muted",
  shelf:
    "min-w-0 flex-[0_1_auto] w-[min(100%,var(--shelf-w))] max-[1099px]:w-full upto-720:order-1 upto-720:col-span-full",
  head: "flex min-w-0 flex-col gap-[0.7rem] upto-720:gap-2 upto-720:self-center",
  title:
    "text-[clamp(2.2rem,4.6vw,3.4rem)] leading-[1.02] font-medium tracking-[-0.025em] text-balance wrap-anywhere upto-720:text-[clamp(1.6rem,7vw,2.2rem)]",
  meta: "flex flex-wrap gap-[0.4rem]",
  metaGenre: `${tag} border-line-soft text-ink-soft`,
  metaReading: `${tag} border-accent text-accent`,
  metaDone: `${tag} border-ok text-ok`,
  // the phones' two headings: "Your copy" there, and "Buy it" everywhere
  deskTitle:
    "mb-[0.6rem] font-brand text-[1.4rem] leading-none font-normal tracking-[1px] uppercase",
  yourCopy:
    "hidden upto-720:order-2 upto-720:col-span-full upto-720:block upto-720:-mb-1.5",
  progress:
    "font-display text-[1.4rem] leading-[1.3] text-ink-soft upto-720:order-3 upto-720:col-span-full upto-720:text-[1.1rem]",
  // "chapter 140", underlined with a wash of spot colour
  chapter:
    "bg-[linear-gradient(to_top,var(--accent-wash)_0_40%,transparent_40%)] text-ink italic",
  // the chapter you're on, stepped right here. Inked like a panel, and big
  // enough for a thumb
  stepperWrap:
    "inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle",
  stepper:
    "inline-flex items-stretch rounded-ink border-[2.5px] border-line bg-card not-italic",
  stepperBtn:
    "grid size-11 place-items-center text-ink transition-colors duration-120 ease-[ease] hover:enabled:bg-accent-wash hover:enabled:text-accent disabled:cursor-default disabled:opacity-40 [&_svg]:size-4 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[2.5] [&_svg]:[stroke-linecap:round]",
  stepperInput:
    "min-w-14 border-x-[2.5px] border-line bg-transparent text-center font-brand text-[1.5rem] leading-none tracking-[0.02em] text-ink tabular-nums [appearance:textfield] focus:bg-accent-wash focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
  saveDone: "font-mono text-[0.8rem] text-ink-soft not-italic empty:hidden",
  saveFailed: "text-[0.9rem] font-medium text-accent not-italic empty:hidden",
  // a line under the control it's about: a failed save, or an undo
  actionNote: "w-full text-[0.9rem] text-ink-soft empty:hidden",
  undo: "ml-1 inline-block py-1 font-medium text-ink underline decoration-accent decoration-2 underline-offset-3",
  // a To read manga: "Not started yet" with its button beside it
  startRow: "inline-flex flex-wrap items-center gap-3",
  // under the counter: the quiet ways to change what it counts
  trackRow:
    "mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 not-italic empty:hidden",
  // one counter to a line, when the chapter and the volume are both kept
  placeLine: "block [&+&]:mt-2",
  // "Track chapters too": a quiet way to the counter
  chaptersToo:
    "tap font-sans text-[0.9rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",

  // rating, notes and the buttons
  body: "flex min-w-0 flex-col gap-4 upto-720:order-4 upto-720:col-span-full",

  // the new release: a slim red bar with the dates folding out under it
  release:
    "min-w-0 animate-card-in motion-reduce:animate-none upto-720:order-1 upto-720:col-span-full",
  releaseBar:
    "relative flex min-h-11.5 flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-ink border-2 border-line bg-accent px-3 py-2 text-on-accent shadow-ink-lg",
  releaseBarOpens:
    "cursor-pointer transition-[filter] duration-120 ease-[ease] hover:brightness-105",
  // the hanko-style stamp knocked onto the bar's top edge, kin to "Done"
  releaseStamp:
    "pointer-events-none absolute -top-5 right-2.5 z-1 upto-720:-top-4 rotate-6 rounded-[4px] border-2 border-accent bg-paper px-[0.35rem] font-brand text-[0.92rem] tracking-[1.5px] text-accent",
  releaseToggle:
    "flex min-w-0 flex-1 basis-40 upto-720:basis-30 cursor-[inherit] flex-wrap items-baseline gap-x-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-on-accent upto-720:flex-col upto-720:items-start",
  releaseHeadline:
    "font-brand text-[1.32rem] leading-none tracking-[1px] whitespace-nowrap",
  releaseOwned: "font-letter text-[0.82rem] leading-tight font-bold",
  releaseBuy:
    "tap ml-auto inline-flex min-h-8 items-center rounded-[3px] border-[1.5px] border-line bg-on-accent px-2.5 text-[0.86rem] font-semibold whitespace-nowrap text-accent transition-colors duration-120 ease-[ease] hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-accent",
  releaseChevron:
    "ml-auto size-4 shrink-0 transition-transform duration-200 ease-ink",
  releaseChevronOpen: "rotate-180",
  releaseDates: "mr-1 border-2 border-t-0 border-line bg-card px-3.5 pt-2 pb-3",
  // "Out now", "Coming up"
  releaseGroup:
    "not-first:mt-3 not-first:border-t not-first:border-dashed not-first:border-line-soft not-first:pt-3",
  releaseGroupTitle: "mb-1 font-mono text-[0.75rem] font-normal text-muted",
  releaseRow: "flex items-baseline justify-between gap-3 py-0.5",
  releaseWhat: "font-semibold whitespace-nowrap",
  // a volume's name as the way to its prices
  releaseLink:
    "tap underline decoration-accent decoration-2 underline-offset-3 hover:text-accent",
  // "Check price →" on the right: the same kind of link as the volume's name
  releaseCompare:
    "tap font-medium text-ink underline decoration-accent decoration-2 underline-offset-3 hover:text-accent",
  releaseWhen: "text-right text-[0.92rem] text-ink-soft",
  releaseEstimate: "ml-1.5 font-mono text-[0.75rem] text-muted",
  label: "mb-[0.3rem] block font-mono text-[0.75rem] text-muted",
  rating: "border-t-[1.5px] border-line pt-4 upto-720:border-t-0 upto-720:pt-0",
  // notes written on a ruled slip; the rule is drawn on the paragraph so
  // every line of text sits on one
  notes:
    "border-[1.5px] border-line-soft bg-card px-4 pt-[0.7rem] pb-[0.6rem] transition-[border-color] duration-120 ease-[ease] focus-within:border-line",
  notesHead: "flex items-baseline justify-between gap-3",
  notesInput:
    "block w-full resize-none bg-transparent bg-[repeating-linear-gradient(to_bottom,transparent_0_calc(1.6em-1px),var(--line-soft)_calc(1.6em-1px)_1.6em)] text-[1rem] leading-[1.6em] [background-attachment:local] [field-sizing:content] outline-none placeholder:text-ink-soft min-h-[3.2em]",
  notesSaved: "font-mono text-[0.75rem] text-muted",
  notesFailed: "text-[0.8rem] font-medium text-accent",

  // where to buy: an inked box under the cover, plain on phones
  buy: "min-w-0 border-2 border-line bg-card p-3 shadow-ink-lg upto-720:order-5 upto-720:col-span-full upto-720:border-0 upto-720:border-t-[1.5px] upto-720:border-dashed upto-720:border-line-soft upto-720:bg-transparent upto-720:px-0 upto-720:pt-4 upto-720:pb-0 upto-720:shadow-none",
  buyList: "flex flex-col gap-2",
  buyLink: `${ticket} grid min-h-11 grid-cols-[minmax(0,1fr)_auto] border-dashed border-line bg-paper font-semibold transition-[background-color,border-color] duration-120 ease-[ease] hover:border-accent hover:bg-accent-wash focus-visible:border-accent focus-visible:bg-accent-wash upto-720:grid-cols-[minmax(0,1fr)_auto_auto] upto-720:border-solid upto-720:bg-card`,
  // the one they need next stands out: inked solid in red on a red wash,
  // with a hard shadow, where the rest are dashed paper
  buyNext: `${ticket} grid min-h-11 grid-cols-[minmax(0,1fr)_auto] border-[2px] border-solid border-accent bg-accent-wash font-semibold shadow-[3px_3px_0_var(--hard-shadow)] transition-[translate,box-shadow] duration-120 ease-[ease] hover:-translate-y-px hover:shadow-[4px_4px_0_var(--hard-shadow)] focus-visible:-translate-y-px upto-720:grid-cols-[minmax(0,1fr)_auto_auto]`,
  // its label in red too
  buyNextKind:
    "col-span-full font-mono text-[0.72rem] font-medium tracking-[0.06em] whitespace-nowrap text-accent uppercase upto-720:col-span-1",
  // "Missing: Vol. 6, Vol. 7": the gaps before the furthest they own, each a
  // link, on a quiet dashed ticket under Next
  buyGaps: `${ticket} flex-col border-dashed border-line-soft`,
  buyGapList: "flex flex-wrap gap-x-3 gap-y-1",
  buyGap:
    "tap font-semibold underline decoration-line-soft underline-offset-3 hover:text-accent hover:decoration-accent",
  // the same series twice on the shelf: said above the page, with the fix
  twiceNote:
    "mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-ink border-2 border-line bg-accent-wash px-3 py-2 shadow-ink text-[0.92rem] text-ink",
  twiceButton:
    "tap font-semibold text-accent underline decoration-2 underline-offset-3 disabled:opacity-60",
  twiceWhy: "basis-full text-[0.82rem] text-ink-soft",
  // the series link, a plain link with room around it for a thumb
  buySeries:
    "tap mt-2.5 block py-1 text-right text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 transition-colors duration-120 ease-[ease] hover:text-accent hover:decoration-accent",
  buyKind:
    "col-span-full font-mono text-[0.72rem] font-normal tracking-[0.06em] whitespace-nowrap text-muted uppercase upto-720:col-span-1",
  buyPrice: "text-right font-mono font-medium text-accent",
  // "2 vols (est)": one row when there's room; on a long series in the narrow
  // box ("113 vols" beside "about $1,340") the "(est)" drops under, never
  // over the price
  buyCount:
    "flex min-w-0 flex-wrap items-baseline gap-x-1 [&>*]:whitespace-nowrap",
  // "(est)" beside a count: quieter than the ticket's own words
  buyAside: "font-normal text-ink-soft italic",
  // "caught up": the same ticket shape, but nothing to click
  buyNote: `${ticket} flex-col border-dashed border-line-soft text-ink-soft`,
  buySkeleton: "h-[110px] upto-720:order-5 upto-720:col-span-full",

  actions:
    "flex flex-wrap items-center gap-[0.85rem] upto-720:[&>.btn-primary]:flex-1 upto-720:[&>.btn-secondary]:flex-1",
  // apart from the everyday actions, so a thumb can't catch it by accident
  deleteBtn: "ml-auto hover:enabled:text-accent upto-720:ml-0 upto-720:px-0",
  confirm:
    "ml-auto inline-flex flex-wrap items-center gap-x-4 text-[0.9rem] text-ink-soft upto-720:ml-0",
  confirmYes:
    "min-h-11 text-[0.9rem] font-semibold text-accent underline underline-offset-3",
  confirmNo:
    "min-h-11 text-[0.9rem] text-ink-soft underline underline-offset-3",

  errorState:
    "mx-auto my-12 max-w-[440px] text-center [&_h1]:mb-2 [&_h1]:text-[2rem] [&_h1]:font-medium [&_p]:text-ink-soft",
  errorActions: "mt-7 flex items-center justify-center gap-4",
} as const;

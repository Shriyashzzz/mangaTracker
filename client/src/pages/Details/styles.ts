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
  // "· reading vol. 12" in the caption, in the shelf marker's red
  shelfPlace: "text-accent",
  shelfCaption:
    "mt-1.5 flex flex-wrap justify-center gap-x-4 text-center font-mono text-[0.8rem] text-muted",
  // "Tap a book to mark it yours.", until they have
  shelfHint: "basis-full text-muted",
  shelf:
    "min-w-0 flex-[0_1_auto] w-[min(100%,var(--shelf-w))] max-[1099px]:w-full upto-720:order-1 upto-720:col-span-full",
  head: "flex min-w-0 flex-col gap-[0.7rem] upto-720:gap-2 upto-720:self-center",
  title:
    "text-[clamp(2.2rem,4.6vw,3.4rem)] leading-[1.02] font-medium tracking-[-0.025em] text-balance wrap-anywhere upto-720:text-[clamp(1.6rem,7vw,2.2rem)]",
  meta: "flex flex-wrap gap-[0.4rem]",
  metaGenre: `${tag} border-line-soft text-ink-soft`,
  metaReading: `${tag} border-accent text-accent`,
  metaDone: `${tag} border-ok text-ok`,
  // the "Buy it" heading
  deskTitle:
    "mb-[0.6rem] font-brand text-[1.4rem] leading-none font-normal tracking-[1px] uppercase",
  progress:
    "font-display text-[1.4rem] leading-[1.3] text-ink-soft upto-720:order-3 upto-720:col-span-full upto-720:text-[1.1rem]",
  // "chapter 140", underlined with a wash of spot colour
  chapter:
    "bg-[linear-gradient(to_top,var(--accent-wash)_0_40%,transparent_40%)] text-ink italic",
  // the chapter they've read up to, stepped right here. Inked like a panel, and big
  // enough for a thumb
  stepperWrap:
    "relative inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle",
  stepper:
    "inline-flex items-stretch rounded-ink border-[2.5px] border-line bg-card not-italic",
  stepperBtn:
    "grid size-11 place-items-center text-ink transition-colors duration-120 ease-[ease] hover:enabled:bg-accent-wash hover:enabled:text-accent disabled:cursor-default disabled:opacity-40 [&_svg]:size-4 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[2.5] [&_svg]:[stroke-linecap:round]",
  stepperInput:
    "min-w-14 border-x-[2.5px] border-line bg-transparent text-center font-brand text-[1.5rem] leading-none tracking-[0.02em] text-ink tabular-nums [appearance:textfield] focus:bg-accent-wash focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent focus-visible:outline-dashed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
  // "Saved", beside the counter (under its right end on a phone). Out of
  // the flow: taking up room, it pushed the counter onto a new line the
  // moment it appeared, out from under the thumb that pressed it
  saveDone:
    "absolute top-1/2 left-full ml-3 -translate-y-1/2 font-mono text-[0.8rem] leading-none whitespace-nowrap text-ink-soft not-italic empty:hidden upto-720:top-full upto-720:right-0 upto-720:left-auto upto-720:mt-[2px] upto-720:ml-0 upto-720:translate-y-0 upto-720:text-[0.7rem]",
  saveFailed: "text-[0.9rem] font-medium text-accent not-italic empty:hidden",
  // a line under the control it's about: a failed save, or an undo
  actionNote: "w-full text-[0.9rem] text-ink-soft empty:hidden",
  undo: "tap ml-1 inline-block py-1 font-medium text-ink underline decoration-accent decoration-2 underline-offset-3",
  // a To read manga: "Not started yet" with its button beside it
  startRow: "inline-flex flex-wrap items-center gap-3",
  // "Your books": the physical books behind the owned volumes, folded away
  books: "border-t border-line-soft pt-3 not-italic",
  booksSummary:
    "tap cursor-pointer font-sans text-[0.95rem] font-medium text-ink marker:text-ink-soft",
  booksCount: "ml-1 font-mono text-[0.8rem] text-ink-soft",
  // "$143.88 paid": what the series has cost them, beside the count
  booksSpent: "ml-3 font-mono text-[0.8rem] font-normal text-accent",
  booksList: "mt-2 flex flex-col",
  // a book: its name, then what was paid, the day, and Remove; the three
  // drop under the name on a phone
  bookRow:
    "grid grid-cols-[minmax(0,1fr)_auto_auto_4rem] items-center gap-x-3 gap-y-1.5 border-b border-dashed border-line-soft py-2 text-[0.92rem] upto-560:grid-cols-[auto_auto_minmax(0,1fr)]",
  bookName: "min-w-0 font-medium text-ink upto-560:col-span-full",
  bookIsbn: "ml-2 font-mono text-[0.74rem] font-normal text-ink-soft",
  bookPaid:
    "inline-flex h-9 items-center gap-1 rounded-[2px] border-[1.5px] border-line-soft bg-paper px-2 font-mono text-[0.85rem] upto-720:h-11 text-ink-soft focus-within:border-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-dashed",
  bookPaidInput:
    "h-full w-[4.2rem] cursor-text bg-transparent text-ink tabular-nums placeholder:text-muted focus:outline-none",
  bookDate:
    "h-9 rounded-[2px] border-[1.5px] border-line-soft bg-paper px-2 font-mono text-[0.8rem] text-ink upto-720:h-11 focus:border-line focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  bookRemove:
    "tap justify-self-end text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-accent hover:decoration-current",
  bookRemoveGap: "upto-560:hidden",
  // the same row when nothing in the list can be removed: no column kept
  // empty for a button
  bookRowPlain:
    "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 border-b border-dashed border-line-soft py-2 text-[0.92rem] upto-560:grid-cols-[auto_minmax(0,1fr)]",
  // "Paid the same for the 12 without a price? $[ ] Set them"
  booksSame:
    "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.88rem] text-ink-soft",
  // the next five rows of a long list
  booksMore:
    "group/more tap mt-1 flex w-full items-baseline justify-between gap-3 py-2 text-left text-[0.85rem] font-medium text-ink",
  // only the words are a link; the count beside them isn't underlined
  booksMoreWords:
    "underline decoration-line-soft underline-offset-3 group-hover/more:decoration-line",
  booksMoreLeft: "font-mono text-[0.78rem] font-normal text-ink-soft",
  booksNote: "mt-2 text-[0.82rem] text-muted",
  // under the counter: the quiet ways to change what it counts. When they
  // wrap onto two lines (a very narrow phone) the lines are far enough
  // apart that one link's thumb-sized landing area doesn't cover the other
  trackRow:
    "mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-6 not-italic empty:hidden upto-720:mt-5",
  // one counter to a line, when the chapter and the volume are both kept
  // "You've read up to ch." and its counter, with room between them, side by
  // side or (on a narrow screen) one above the other
  placeLine: "flex flex-wrap items-center gap-x-3 gap-y-2 [&+&]:mt-2",
  // "Keep my place by [Chapter] [Volume]": under what they own, for a
  // series with no place saved. Small plain words, then the two buttons
  pickPlace:
    "mt-2 flex min-h-12 flex-wrap items-center gap-x-2.5 gap-y-2 font-sans text-[0.92rem] text-ink-soft not-italic first:mt-0",
  pickButtons: "inline-flex gap-2.5",
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
  // the series' rating and, beside it, the latest volume's: two of a
  // kind, a label over five stars. Stacked on a phone
  ratings:
    "grid grid-cols-[auto_minmax(0,1fr)] gap-x-[clamp(1.5rem,5vw,3.5rem)] gap-y-3 border-t-[1.5px] border-line pt-4 upto-720:grid-cols-1 upto-720:border-t-0 upto-720:pt-0",
  rating: "min-w-0",
  // The volume's rating beside the series': a ticket like the ones in "Buy
  // it" (dashed, on card paper), its number on an inked stub like a cover's
  // number tab, and smaller stars than the series'. One is a rating of the
  // series; this is a slip about one book
  rateTicket:
    "relative flex w-fit max-w-full items-stretch self-end border-[1.5px] border-dashed border-line bg-card upto-720:w-full",
  // its cross, in the top corner, with a thumb-sized landing area
  rateTicketClose:
    "absolute top-0.5 right-0.5 grid size-7 place-items-center text-ink-soft transition-[color,transform] duration-150 ease-ink before:absolute before:-inset-2 before:content-[''] hover:text-accent active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:outline-dashed",
  rateStub:
    "flex min-w-[3.4rem] flex-none flex-col items-center justify-center bg-ink px-2.5 pt-1 pb-0.5 font-brand text-[1.5rem] leading-none tracking-[0.02em] text-paper [&_small]:text-[0.7rem] [&_small]:tracking-[0.08em] [&_small]:uppercase",
  // two short rows: a line of words, then the stars. The same height
  // rated or not, so nothing below moves
  rateTicketBody:
    "flex min-w-0 flex-1 flex-col items-start py-1 pr-3.5 pl-1.5 [&>p]:pl-3",
  rateTicketTop:
    "flex min-h-7 w-full flex-wrap items-center gap-x-3.5 pl-3 text-[0.84rem]",
  rateTicketLabel: "font-mono text-[0.75rem] text-muted",
  // The ways on, in that line. Each is as tall as the line (28px) and no
  // taller: a thumb-sized landing area here would reach down over the
  // stars under it
  rateTicketLinks:
    "flex flex-wrap gap-x-3.5 [&>*]:tap [&>*]:min-h-7 [&>*]:text-ink-soft [&>*]:underline [&>*]:decoration-line-soft [&>*]:underline-offset-3 [&>*]:hover:text-ink [&>*]:hover:decoration-current",
  // "How was vol. 9?", after they finish a volume: a box like the notes box
  // under it (same border and paper), so it sits in the page instead of on
  // top of it. One row on a laptop: the words, then the stars. Two short
  // rows on a phone, the same height rated or not so nothing moves
  rateCard:
    "relative flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-[1.5px] border-line-soft bg-card py-[0.45rem] pr-11 pl-4 upto-720:gap-y-3 upto-720:py-[0.6rem]",
  // the banner's way in: it opens downward over a third of a second, so
  // the page below slides instead of jumping
  rateCardIn:
    "grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-ink motion-reduce:transition-none starting:grid-rows-[0fr]",
  rateCardClip: "min-h-0 overflow-hidden",
  // The small volume rating gives way to the banner the same way, closing
  // as the banner opens, so on a phone (where one sits under the other)
  // the page below stays where it is. Closed, it takes no room: not even
  // the gap the phone's stacked ratings keep between them
  // (its clip keeps a little room around the stars, for their focus ring)
  rateSmallClip: "-m-1 min-h-0 overflow-hidden p-1",
  rateSmall:
    "grid min-w-0 grid-rows-[1fr] transition-[grid-template-rows,margin] duration-300 ease-ink motion-reduce:transition-none",
  rateSmallClosed:
    "grid min-w-0 grid-rows-[0fr] transition-[grid-template-rows,margin] duration-300 ease-ink motion-reduce:transition-none upto-720:-mt-3",
  // the question, then why (or, once rated, the way to add words) beside
  // it on the same line where there's room
  rateWords: "flex min-h-6 min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5",
  // the cross: bare brush strokes tucked into the panel's top-right corner,
  // no box or ring around them. The ::before makes it a thumb wide without
  // drawing it bigger; the panel keeps room on the right so the stars never
  // sit under it
  rateClose:
    "absolute top-1 right-1 grid size-7 place-items-center text-ink transition-[color,transform] duration-150 ease-ink before:absolute before:-inset-2 before:content-[''] hover:text-accent active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:outline-dashed",
  rateTitle: "font-display text-[1.05rem] leading-[1.25] font-semibold",
  // why to rate: said on a laptop, where there's a line for it
  rateNote: "text-[0.84rem] text-muted upto-720:hidden",
  // under a volume's stars once it's rated: the quiet ways on
  rateLinks:
    "flex flex-wrap gap-x-4 text-[0.84rem] [&>*]:tap [&>*]:text-ink-soft [&>*]:underline [&>*]:decoration-line-soft [&>*]:underline-offset-3 [&>*]:hover:text-ink [&>*]:hover:decoration-current",
  // "Your reviews": a row for each volume they've rated, in the same list
  // as "Your books"
  reviewRow:
    "grid grid-cols-[4.25rem_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-dashed border-line-soft py-[0.6rem] text-[0.92rem]",
  reviewVolume: "font-medium text-ink",
  reviewEdit:
    "tap justify-self-end text-[0.85rem] font-medium text-ink underline decoration-line-soft underline-offset-3 hover:decoration-line",
  reviewWords:
    "col-span-full line-clamp-3 max-w-[62ch] text-ink-soft [overflow-wrap:anywhere]",
  reviewNoWords: "col-span-full text-[0.84rem] text-muted",
  // the box a review is written in, over the page
  reviewDialog:
    "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-ink border-[2.5px] border-line bg-card p-0 text-ink shadow-ink-lg backdrop:bg-[rgba(20,14,8,0.55)]",
  reviewDialogBox: "p-5 upto-520:p-4",
  reviewDialogTitle:
    "font-brand text-[1.6rem] leading-[1.1] font-normal tracking-[0.02em] uppercase",
  reviewDialogNote: "mt-1 mb-4 text-[0.88rem] text-ink-soft",
  reviewDialogDelete:
    "mt-1 border-t border-dashed border-line-soft pt-3 text-[0.85rem] text-muted [&_button]:tap [&_button]:text-ink-soft [&_button]:underline [&_button]:decoration-line-soft [&_button]:underline-offset-3 [&_button]:hover:text-accent-ink",
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
    "col-span-full font-mono text-[0.72rem] font-medium tracking-[0.06em] whitespace-nowrap text-accent-ink uppercase upto-720:col-span-1",
  // "Missing: Vol. 6, Vol. 7": the gaps before the furthest they own, each a
  // link, on a quiet dashed ticket under Next
  buyGaps: `${ticket} flex-col border-dashed border-line-soft`,
  // each link is as tall as its row (a thumb's height on a phone), so on
  // two rows one never lands on the other
  buyGapList: "flex flex-wrap gap-x-3",
  buyGap:
    "inline-flex min-h-8 items-center font-semibold underline decoration-line-soft underline-offset-3 hover:text-accent hover:decoration-accent upto-720:min-h-11",
  // the same series twice on the shelf: said above the page, with the fix
  twiceNote:
    "mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-ink border-2 border-line bg-accent-wash px-3 py-2 shadow-ink text-[0.92rem] text-ink",
  twiceButton:
    "tap font-semibold text-accent underline decoration-2 underline-offset-3 disabled:opacity-60",
  twiceWhy: "basis-full text-[0.82rem] text-ink-soft",
  // "Buy it" with "as Deluxe" across from it: which edition the box counts in
  // phones: Buy it folded under one line, high on the page. The line says
  // the book and its price, so it's worth reading closed
  buyFold:
    "border-t-[1.5px] border-dashed border-line-soft pt-3 [&[open]>summary>svg]:rotate-180",
  buyFoldSummary:
    "tap flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden",
  buyFoldTitle:
    "font-brand text-[1.35rem] leading-none tracking-[0.03em] uppercase",
  buyFoldTicket:
    "min-w-0 flex-1 truncate font-mono text-[0.85rem] font-medium text-accent tabular-nums",
  buyFoldChevron:
    "size-5 shrink-0 text-ink-soft transition-transform duration-200 motion-reduce:transition-none",
  // opened: the box without its own frame, the line above is its heading
  buyOpened: "min-w-0 pt-2 [&>div:first-child>h2]:sr-only",
  buyHead:
    "mb-[0.6rem] flex flex-wrap items-center justify-between gap-x-2 [&_h2]:mb-0",
  // "vols. 7–9, you have 1 of 3": under the next book's row, the ticket's width
  buyInside: "col-span-full text-[0.85rem] font-normal text-ink-soft italic",
  // books past the last one listed: said quietly, nothing to click
  buyLater: "px-1 text-[0.82rem] text-ink-soft",
  // the series link, a plain link with room around it for a thumb
  buySeries:
    "tap mt-2.5 block py-1 text-right text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 transition-colors duration-120 ease-[ease] hover:text-accent hover:decoration-accent",
  // (on the narrowest phones a long label takes two lines rather than
  // running into what's beside it)
  buyKind:
    "col-span-full font-mono text-[0.72rem] font-normal tracking-[0.06em] whitespace-nowrap text-muted uppercase upto-720:col-span-1 max-[359px]:whitespace-normal",
  buyPrice: "text-right font-mono font-medium text-accent-ink",
  // "ch. 35–43" under "Vol. 5" in Next for you, for a chapter reader
  buyChapters: "block font-mono text-[0.78rem] font-normal text-ink-soft",
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

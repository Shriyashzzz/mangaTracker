// Tailwind classes for the price checker: the price home (PriceSearch +
// SeriesSearchBox), series pages (PriceSeries, SeriesFacts), volume pages
// (PriceVolume, ShelfAction), the A to Z index (SeriesIndex) and the cards
// they share (VolumeCard, SeriesCard). Phones are upto-720.
//
// Two plain marker classes, `prices-page` and `prices-promo`, have no styles
// of their own; they let a child (crumbs, sectionTitle) adjust itself when
// it sits inside them, as the original CSS did.

// a dropdown row in the series typeahead
const suggestionRow = "flex cursor-pointer items-center gap-3 rounded-[2px]";

// underlined text link look used across the pages
const softLink = "underline decoration-line-soft underline-offset-3";

// a row of store names to tap ("More places to look", "Looking for a box
// set?"). On a laptop they sit in a line, each at least as wide as its name
// and stretched so every row reaches the right edge (one left over on a
// second row takes it all). On a phone they're an even grid of two, a full
// finger tall; an odd one out takes the whole row
const storeButtons =
  "flex flex-wrap gap-2 [&>li]:grow [&_a]:w-full [&_a]:text-center upto-720:grid upto-720:grid-cols-2 upto-720:[&>li:last-child:nth-child(odd)]:col-span-2 [&_a]:tap [&_a]:inline-block [&_a]:rounded-[2px] [&_a]:border-[1.5px] [&_a]:border-line [&_a]:bg-card [&_a]:px-[0.8rem] [&_a]:py-[0.35rem] [&_a]:text-[0.88rem] [&_a]:font-medium [&_a]:transition-[background-color,color] [&_a]:duration-120 [&_a]:ease-[ease] [&_a]:hover:bg-ink [&_a]:hover:text-paper upto-720:[&_a]:flex upto-720:[&_a]:min-h-11 upto-720:[&_a]:items-center upto-720:[&_a]:justify-center upto-720:[&_a]:text-center";

export const pricesStyles = {
  // ---------- price home + search ----------
  page: "prices-page flex flex-col gap-8",
  // the what's new list hangs off this, out in the page's right margin
  front: "relative",
  // the two halves of the app, side by side for anyone new
  homeTitle:
    "font-brand text-[clamp(2.1rem,6.5vw,4.6rem)] leading-[0.98] font-normal tracking-[0.01em] text-balance uppercase",
  // a word in a heading painted over with one tilted stroke, the letters
  // knocked out of it: "tracked" and "priced" here
  homeHit: "inline-block -rotate-2 bg-ink px-[0.12em] text-paper",
  // the same stroke in the accent with white letters, on After the anime's
  // heading: the colour of the "Finished the anime?" door on this page that
  // leads there, at the shade white letters can be read on (index.css --paint)
  accentHit: "inline-block -rotate-2 bg-paint px-[0.12em] text-on-paint",
  halves:
    "grid grid-cols-2 gap-[clamp(1rem,2.5vw,1.5rem)] upto-860:grid-cols-[minmax(0,1fr)] [&>*]:min-w-0",
  // side by side both halves are the same height, the title level with the
  // price search's. The buttons follow the words straight away: kept level
  // with the search's "Try" row they left a gap in the middle of the card
  trackHalf:
    "speed-burst relative flex flex-col items-start gap-3 border-3 border-line p-[clamp(1.25rem,3vw,2rem)] upto-720:gap-2 upto-720:py-4",
  // ink on paper in every theme, or his hair disappears into the dark panel
  halfMascot:
    "absolute top-3 right-3 block aspect-square w-16 overflow-hidden rounded-full border-2 border-line bg-card px-1.5 pt-1.5 upto-520:w-11 upto-520:px-1 upto-520:pt-1",
  halfTitle:
    "pr-12 font-brand text-[clamp(1.6rem,4vw,2.6rem)] leading-[1] font-normal tracking-[0.02em] uppercase",
  // one row: all three on wider screens, the two that show on phones
  halfActions:
    "half-actions flex flex-nowrap items-center gap-2 pt-2 upto-720:gap-2 upto-720:pt-0.5",

  // what the shelf does, at the card's foot: only side by side (stacked,
  // the card has no empty space to fill)
  trackGets:
    "mt-auto grid gap-1.5 border-t border-dashed border-line-soft pt-4 text-[0.95rem] text-ink-soft upto-860:hidden [&>li]:flex [&>li]:items-center [&>li]:gap-2",
  halfButton:
    "half-button min-w-0 px-[0.75rem] upto-720:h-11 upto-720:px-[0.7rem] upto-720:text-[0.875rem]",
  searchHead:
    "speed-burst flex flex-col gap-3 border-3 border-line p-[clamp(1.25rem,3vw,2rem)]",
  title:
    "font-brand text-[clamp(2.4rem,6vw,3.6rem)] leading-[0.95] font-normal tracking-[0.02em] uppercase",
  sub: "text-[1.05rem] text-ink-soft",
  // on phones the dropdown spans the whole search row, not just the input
  searchForm: "mt-2 flex gap-3 upto-720:relative upto-720:[&>.btn]:px-[1.1rem]",
  comboWrap: "relative min-w-0 flex-1 upto-720:static",
  suggestions:
    "absolute inset-x-0 top-[calc(100%+6px)] z-15 border-[2.5px] border-line bg-card p-[0.35rem] shadow-[0_12px_28px_-12px_rgba(0,0,0,0.45)]",
  suggestion: `${suggestionRow} px-[0.55rem] py-[0.45rem]`,
  suggestActive: "bg-paper-2",
  suggestThumb:
    "relative aspect-2/3 w-[34px] shrink-0 overflow-hidden border border-line-soft bg-paper-2 [&_img]:size-full [&_img]:object-cover",
  suggestText: "flex min-w-0 flex-col",
  // two lines, so titles that differ only at the end ("Frieren ... ~Prelude~")
  // can be told apart
  suggestName: "line-clamp-2 font-semibold",
  suggestMeta: "font-mono text-[0.75rem] text-muted",
  suggestNote: "px-[0.55rem] py-[0.6rem] text-[0.9rem] text-muted",
  // the last row: "See all results"
  seeAll: `${suggestionRow} mt-1 justify-center border-t border-dashed border-line-soft p-[0.6rem] text-[0.9rem] font-medium text-ink-soft`,
  searchBox:
    "flex h-[50px] w-full min-w-0 items-center gap-[0.6rem] border-[2.5px] border-line bg-paper px-4 text-muted focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-wash)] [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-none [&_input]:bg-transparent [&_input]:text-[1.05rem] [&_input]:text-ink [&_input]:outline-none [&_input]:placeholder:text-muted [&_svg]:size-[19px] [&_svg]:shrink-0",
  // "Try: One Piece, Jujutsu Kaisen, ..."
  quick:
    "flex flex-wrap items-center gap-2 text-[0.85rem] text-muted upto-720:grid upto-720:grid-cols-3 upto-720:[&_span]:col-span-full upto-720:[&_a]:min-h-11 upto-720:[&_a]:place-items-center upto-720:[&_a]:px-1 upto-720:[&_a]:text-center [&_a]:tap [&_a]:rounded-[2px] [&_a]:border-[1.5px] [&_a]:border-line-soft [&_a]:bg-paper [&_a]:px-[0.65rem] [&_a]:py-[0.2rem] [&_a]:text-[0.85rem] [&_a]:text-ink-soft [&_a]:transition-[border-color] [&_a]:duration-120 [&_a]:ease-[ease] [&_a]:hover:border-line [&_a]:hover:text-ink",
  // the way in for someone coming from the anime: a caption strip under the
  // two panels, inked in like a manga caption box, the question on a tilted
  // accent label. The whole strip is the link
  animeDoor:
    "tap group mt-[clamp(1rem,2.5vw,1.5rem)] flex flex-wrap items-center gap-x-6 gap-y-2.5 border-3 border-line bg-ink px-[clamp(1.25rem,3vw,2rem)] py-4 text-paper shadow-ink transition-[translate] duration-150 ease-ink hover:-translate-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent focus-visible:outline-dashed motion-reduce:transition-none",
  animeDoorTitle:
    "-rotate-2 bg-accent px-[0.35em] pt-[0.12em] pb-[0.05em] font-brand text-[clamp(1.3rem,2.6vw,1.75rem)] leading-none tracking-[0.03em] whitespace-nowrap text-on-accent uppercase",
  animeDoorText: "min-w-0 flex-1 basis-[15rem] text-[1.02rem] leading-snug",
  animeDoorGo:
    "font-semibold whitespace-nowrap underline decoration-accent decoration-2 underline-offset-4 group-hover:decoration-current",
  // inside a results section the count sits above the grid, not overlapping
  count: "-mb-4 font-mono text-[0.78rem] text-muted [section>&]:mb-[0.9rem]",

  // a series page's stamps for one on their shelf: owned, and the next one
  // "Yours" and "Next" on a cover: top right, across from the number tab.
  // On a phone's narrow covers that corner is the tab's ("Vol. 12" reaches
  // it), so they sit on the lower left instead, above the line the
  // readers' score badge is on
  markYours:
    "absolute top-2 right-1.5 z-1 rotate-6 rounded-[3px] border-2 border-line bg-paper px-1.5 font-brand text-[0.85rem] leading-[1.35] tracking-[1px] text-ink uppercase upto-720:top-auto upto-720:right-auto upto-720:bottom-8 upto-720:left-1.5 upto-720:-rotate-3",
  markNext:
    "absolute top-2 right-1.5 z-1 rotate-6 rounded-[3px] border-2 border-line bg-accent px-1.5 font-brand text-[0.85rem] leading-[1.35] tracking-[1px] text-on-accent uppercase upto-720:top-auto upto-720:right-auto upto-720:bottom-8 upto-720:left-1.5 upto-720:-rotate-3",
  // "Not on your shelf" and what finishing the series costs, side by side; the
  // total wraps under the button on a narrow phone
  // as wide as what's in it: the tour's ring goes round just that
  toGetRow:
    "mb-3 flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-1.5",
  finishCost: "text-[0.9rem] font-medium text-ink tabular-nums",
  // the home page's four panels for someone new: laid out like a page of
  // manga panels, gutters and all; four across, two on a tablet, one on a
  // phone
  why: "mt-12 flex flex-col gap-3",
  whyPanels:
    "grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2 upto-520:grid-cols-1",
  whyPanel:
    "relative flex flex-col gap-2 border-3 border-line bg-card px-5 pt-5 pb-4 odd:rotate-[-0.4deg] even:rotate-[0.4deg] upto-520:rotate-0",
  whyTitle:
    "font-brand text-[1.35rem] leading-[1.05] font-normal tracking-[0.03em] uppercase",
  whyBody: "text-[0.92rem] leading-snug text-ink-soft",
  whyLink:
    "tap mt-auto pt-1 text-[0.9rem] font-medium underline decoration-accent decoration-2 underline-offset-3",
  // a series' box sets, under its volumes
  boxSets: "mt-10 flex flex-col gap-3",
  // "Other editions": the deluxe and omnibus books, a row each
  editions: "mt-10 scroll-mt-24",
  editionTabs: "mb-3 flex flex-wrap gap-2",
  editionTab:
    "tap inline-flex min-h-9 items-center gap-2 rounded-[2px] border-[1.5px] border-line-soft bg-paper px-3 text-[0.88rem] font-medium text-ink-soft transition-[color,border-color,background-color] duration-120 ease-[ease] hover:border-line hover:text-ink aria-pressed:border-line aria-pressed:bg-ink aria-pressed:text-paper",
  editionTabCount: "font-mono text-[0.72rem] opacity-70",
  // under a line's books: the whole run new, its books and the singles
  editionCosts:
    "mt-4 flex flex-col gap-0.5 font-mono text-[0.82rem] text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink",
  // the way to every series with editions
  editionsMore:
    "tap mt-3 inline-block w-fit text-[0.9rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  editionList:
    "mb-4 grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-x-8 border-t-[1.5px] border-line",
  editionRow:
    "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-dashed border-line-soft py-2.5",
  editionName: "font-semibold text-ink",
  editionPrice:
    "tap row-span-2 self-center text-right font-mono text-[0.85rem] font-medium text-accent underline decoration-transparent underline-offset-3 hover:decoration-current",
  editionInside: "col-start-1 font-mono text-[0.78rem] text-ink-soft",
  editionUnlisted:
    "row-span-2 self-center text-right font-mono text-[0.78rem] text-muted",
  // signed out on a volume page: the button and what tracking gets them
  // on a phone the button is as wide as the column it sits in
  trackPitch:
    "flex max-w-[34rem] flex-col items-start gap-2 upto-720:items-stretch",
  // the button says enough on a phone, where the prices need the room
  trackWhy: "text-[0.85rem] leading-snug text-ink-soft upto-720:hidden",
  // what collecting the whole series costs: a printed receipt-like slip with
  // the total in the display face; the button drops under it on a phone
  costBox:
    "mb-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-2 border-line bg-card px-5 py-4 shadow-ink upto-520:px-4 upto-520:[&>.btn]:w-full",
  costText: "flex min-w-0 flex-col gap-1",
  costLabel:
    "font-brand text-[1.05rem] leading-none font-normal tracking-[0.04em] text-accent uppercase",
  costTotal:
    "font-display text-[1.45rem] leading-tight text-ink-soft upto-520:text-[1.25rem] [&_strong]:font-semibold [&_strong]:text-ink [&_strong]:tabular-nums",
  costNote: "max-w-[60ch] text-[0.85rem] text-ink-soft",
  // "Not on your shelf": the series page's filter, for one on their shelf
  toGet:
    "tap rounded-[2px] border-[1.5px] border-line-soft bg-paper px-2.5 py-1 text-[0.85rem] font-medium text-ink-soft hover:border-line hover:text-ink aria-pressed:border-line aria-pressed:bg-ink aria-pressed:text-paper",

  // ---------- cards ----------
  grid: "grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-7 upto-720:grid-cols-3 upto-720:gap-x-3 upto-720:gap-y-5",
  card: "group flex flex-col gap-[0.35rem] focus-visible:outline-none",
  // covers lean as if pulled off the shelf, each a little differently. The
  // image sits over a drawn placeholder (coverFallback)
  cover:
    "relative block aspect-2/3 overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-ink-lg transition-[translate,rotate,box-shadow] duration-200 ease-ink group-hover:-translate-x-0.5 group-hover:-translate-y-[3px] group-hover:-rotate-1 group-hover:shadow-[6px_7px_0_var(--hard-shadow)] group-focus-visible:outline-2 group-focus-visible:outline-offset-3 group-focus-visible:outline-accent group-focus-visible:outline-dashed [li:nth-child(3n+2)>.group:hover_&]:rotate-[0.8deg] [&>img]:relative [&>img]:size-full [&>img]:object-cover [&>img]:transition-opacity [&>img]:duration-350 [&>img]:ease-ink",
  coverFallback:
    "cover-lines absolute inset-0 grid place-items-center font-brand text-[3rem] text-muted upto-720:text-[2rem]",
  // the same, for a small tile (the shelf's Volumes tab)
  coverFallbackSmall:
    "cover-lines absolute inset-0 grid place-items-center font-brand text-[1.8rem] text-muted",
  // the series cover standing in for a missing volume cover; the drawn
  // number shows again if it fails too
  seriesFallback: "absolute inset-0 size-full object-cover",
  // the same picture standing in for a later volume, under a paper veil
  // that washes it out, so it reads as a stand-in beside real covers. The
  // veil goes when the picture fails, leaving the drawn number clear
  seriesStandIn: "absolute inset-0 size-full object-cover saturate-50",
  standInVeil: "absolute inset-0 bg-paper/55 [img[hidden]+&]:hidden",
  // On the shelf's small tiles a stand-in sits among the reader's own
  // covers under a "Yours" label, so it's washed out further: nearly
  // colourless under a heavier veil, plainly not that volume's cover
  seriesStandInSmall: "absolute inset-0 size-full object-cover saturate-[0.15]",
  standInVeilSmall: "absolute inset-0 bg-paper/75 [img[hidden]+&]:hidden",
  // its number on a paper plate, where the card has no corner tab for it
  standInNumber:
    "absolute top-1/2 left-1/2 -translate-1/2 -rotate-3 border-2 border-line bg-paper px-[0.4em] pt-[0.12em] pb-[0.02em] text-[0.8em] leading-none text-ink shadow-ink",
  // the volume number as a tab on the top corner, readable at a glance even
  // when several volumes share the series cover
  // a book holding several volumes: the cards behind it, fanned like a hand
  // of playing cards, each a copy of its cover a little further round
  // phones: a smaller fan, opening to the left. Out past the right edge it
  // widened the page, and Safari zoomed out to fit it (Vinland Saga)
  stack:
    "relative block [--fan:1] [--fan-dir:1] upto-520:[--fan:0.5] upto-520:[--fan-dir:-1]",
  stackBack:
    "pointer-events-none absolute inset-0 origin-bottom-left upto-520:origin-bottom-right overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-ink transition-[rotate,translate] duration-200 ease-ink [&>img]:size-full [&>img]:object-cover [&>img]:opacity-85",
  vol: "absolute top-0 left-0 flex items-baseline gap-[0.2rem] bg-ink pt-[0.2rem] pr-[0.85rem] pb-[0.1rem] pl-2 font-brand text-[1.5rem] leading-none tracking-[0.02em] text-paper [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)] [&_small]:text-[0.75rem] [&_small]:tracking-[0.08em] [&_small]:uppercase",
  // readers' score on a cover's lower corner: a small paper label
  coverRating:
    "absolute right-1.5 bottom-1.5 z-1 flex items-center gap-[0.2rem] border-[1.5px] border-line bg-card px-[0.35rem] pt-[0.2rem] pb-[0.14rem] font-mono text-[0.76rem] leading-none font-medium text-ink shadow-[2px_2px_0_var(--hard-shadow)] tabular-nums [&_svg]:size-3 [&_svg]:stroke-line [&_svg]:text-star",
  // the whole series' score: the same badge hung on the corner of its
  // cover, over the cover's right edge. It sits in the box around the cover
  // (scoredCover), above it, because the cover itself clips
  scoredCover: "relative block",
  seriesScore:
    "absolute -right-1.5 bottom-2 z-2 flex items-center gap-[0.2rem] border-[1.5px] border-line bg-card px-[0.35rem] pt-[0.2rem] pb-[0.14rem] font-mono text-[0.76rem] leading-none font-medium text-ink shadow-[2px_2px_0_var(--hard-shadow)] tabular-nums [&_svg]:size-3 [&_svg]:stroke-line [&_svg]:text-star",
  cardTitle: "line-clamp-2 text-[0.92rem] leading-[1.3] font-semibold",
  cardMeta: "text-[0.8rem] text-muted",
  cardPrice:
    "flex items-baseline gap-[0.4rem] font-mono text-[0.9rem] font-medium",
  cardWas: "text-[0.75rem] font-normal text-muted",
  cardSkeleton: "aspect-2/3",
  // a horizontal shelf of cards, scrolls sideways when it runs long
  row: "grid snap-x snap-proximity auto-cols-[132px] grid-flow-col gap-5 overflow-x-auto pb-[0.6rem] [scrollbar-color:var(--line-soft)_transparent] [scrollbar-width:thin] [&>li]:snap-start",

  // ---------- empty and error states ----------
  empty:
    "mx-auto my-4 flex max-w-[460px] flex-col items-center gap-[0.6rem] border-[1.5px] border-dashed border-line-soft p-8 text-center text-ink-soft",
  emptyActions: "mt-2 flex flex-wrap justify-center gap-3",
  emptyTitle: "font-display text-[1.5rem] font-semibold text-ink",
  // the same pointer, slimmed down for the margin above what's new

  // ---------- volume page: cover beside everything else ----------
  volume:
    "grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1fr] items-start gap-x-[clamp(2rem,5vw,3.5rem)] gap-y-5 upto-720:grid-cols-[104px_minmax(0,1fr)] upto-720:gap-x-4",
  volumeCover:
    "relative col-start-1 row-span-2 row-start-1 aspect-2/3 h-[clamp(240px,calc(100dvh-260px),360px)] border-[1.5px] border-line shadow-[6px_6px_0_var(--hard-shadow)] upto-720:row-span-1 upto-720:h-auto upto-720:w-full upto-720:shadow-ink-lg [&>img]:relative [&>img]:size-full [&>img]:object-cover [&>img]:transition-opacity [&>img]:duration-350 [&>img]:ease-ink",
  coverSkeleton: "rounded-none",
  volumeHead: "col-start-2 row-start-1 flex min-w-0 flex-col gap-[0.45rem]",
  volumeTitle:
    "text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.05] font-medium tracking-[-0.02em] text-balance wrap-anywhere upto-720:text-[clamp(1.4rem,6vw,1.9rem)]",
  volumeMeta: "text-ink-soft",
  isbn: "font-mono text-[0.78rem] text-muted",
  // the headline price: on a phone the price list right under it says the
  // same with its stamps, so it gives its room to that list instead
  bestLine:
    "mt-[0.35rem] font-display text-[1.35rem] text-ink-soft upto-720:hidden [&_strong]:font-semibold [&_strong]:text-ink",
  // "most volumes are about $11.99", "checked 17 days ago": quieter than the price
  bestAside: "font-sans text-[0.95rem] text-muted",
  volumeBody:
    "col-start-2 row-start-2 flex min-w-0 flex-col gap-6 upto-720:col-span-2 upto-720:col-start-1",
  // Bangers heading with a short inked stroke underneath
  sectionTitle:
    "mb-[0.6rem] inline-block bg-[linear-gradient(var(--accent),var(--accent))] bg-size-[1.8em_3px] bg-left-bottom bg-no-repeat pb-[0.2rem] font-brand text-[1.45rem] font-normal tracking-[0.03em] uppercase [.prices-promo_&]:mb-1",
  sectionHead: "mb-3 flex flex-col items-start justify-between gap-4",
  // the heading with something small across from it
  sectionHeadRow:
    "mb-3 flex flex-wrap items-baseline justify-between gap-x-4 [&_h2]:mb-0",
  sectionNote:
    "-mt-[0.2rem] mb-3 max-w-[48ch] text-[0.95rem] leading-[1.35] text-ink-soft",
  checked: "text-[0.8rem] text-muted",
  // the same words, opening how old each store's price is (PriceAges.tsx)
  ages: "relative",
  agesToggle:
    "cursor-pointer list-none text-[0.8rem] text-muted underline decoration-dotted decoration-1 underline-offset-[3px] transition-colors duration-120 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden [[open]>&]:text-ink",
  agesBox:
    "absolute top-[calc(100%+0.45rem)] right-0 z-20 w-max min-w-[13.5rem] max-w-[min(18rem,calc(100vw-2rem))] border-[1.5px] border-line bg-card px-3.5 pt-2.5 pb-3 shadow-ink upto-720:right-auto upto-720:left-0",
  agesTitle:
    "mb-1.5 font-letter text-[0.72rem] font-bold tracking-[0.05em] text-muted uppercase",
  agesList: "flex flex-col gap-1",
  agesRow: "flex items-baseline justify-between gap-6 text-[0.86rem] text-ink",
  agesWhen: "font-mono text-[0.76rem] whitespace-nowrap text-muted",
  // "checked … ago" and the US/Canada switch; on phones, where they wrap
  // under the heading, they spread to either side. The switch stays on the
  // right even with no "checked" text beside it
  checkedRow:
    "flex items-center gap-3 upto-720:w-full upto-720:justify-between [&>:last-child]:ml-auto",
  // "Also in a box set, from $133.90 →", under the price list
  boxSetNote: "mt-2 text-[0.88rem] text-ink-soft",
  boxSetNoteLink:
    "tap font-mono font-medium text-accent underline decoration-transparent underline-offset-3 hover:decoration-current",
  // the price list
  offers:
    "border-2 border-line bg-card [&>li+li]:border-t [&>li+li]:border-dashed [&>li+li]:border-line-soft",
  // one whole row is the link: thumb sized, and it lights up as one thing
  offerRow:
    "grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-5 px-4 py-[0.7rem] transition-colors duration-120 ease-[ease] [a&]:hover:bg-accent-wash upto-720:gap-x-3",
  offerGo:
    "flex items-center gap-1 text-[0.88rem] font-medium text-ink-soft underline-offset-3 [a:hover_&]:text-accent [&_svg]:size-4 [&_span]:underline [&_span]:decoration-line-soft",
  // the overall cheapest copy's row gets a wash
  lowestOffer: "bg-accent-wash",
  // the store name with its stamps; stamps wrap under a long name
  offerName: "flex flex-wrap items-center gap-x-2 gap-y-[0.3rem]",
  // stamps. Awards are tilted stickers with an ink shadow in strong colors:
  // red for the lowest overall, green for the cheapest new copy, marigold
  // for the cheapest marketplace one, indigo for a box set. Type labels sit flat in the light
  // version of the same color, so green always means new, marigold
  // marketplace or used, blue ebook
  awardLowest:
    "inline-block -rotate-2 rounded-[2px] border-[1.5px] border-line px-[0.4rem] pt-[0.1rem] font-brand text-[1rem] leading-[1.15] font-normal tracking-[1px] uppercase shadow-[2px_2px_0_var(--hard-shadow)] bg-accent text-on-accent",
  awardNew:
    "inline-block rotate-1 rounded-[2px] border-[1.5px] border-line px-[0.4rem] pt-[0.1rem] font-brand text-[1rem] leading-[1.15] font-normal tracking-[1px] uppercase shadow-[2px_2px_0_var(--hard-shadow)] bg-award-new text-on-award-new",
  awardMarket:
    "inline-block -rotate-1 rounded-[2px] border-[1.5px] border-line px-[0.4rem] pt-[0.1rem] font-brand text-[1rem] leading-[1.15] font-normal tracking-[1px] uppercase shadow-[2px_2px_0_var(--hard-shadow)] bg-award-market text-stamp-ink",
  awardSet:
    "inline-block rotate-2 rounded-[2px] border-[1.5px] border-line px-[0.4rem] pt-[0.1rem] font-brand text-[1rem] leading-[1.15] font-normal tracking-[1px] uppercase shadow-[2px_2px_0_var(--hard-shadow)] bg-award-set text-on-award-set",
  labelNew:
    "inline-block rounded-[2px] border border-line px-[0.35rem] pt-[0.05rem] font-brand text-[0.88rem] leading-[1.15] font-normal tracking-[1px] text-stamp-ink uppercase bg-stamp-new",
  labelMarket:
    "inline-block rounded-[2px] border border-line px-[0.35rem] pt-[0.05rem] font-brand text-[0.88rem] leading-[1.15] font-normal tracking-[1px] text-stamp-ink uppercase bg-stamp-market",
  labelEbook:
    "inline-block rounded-[2px] border border-line px-[0.35rem] pt-[0.05rem] font-brand text-[0.88rem] leading-[1.15] font-normal tracking-[1px] text-stamp-ink uppercase bg-stamp-ebook",
  offerStore: "flex flex-col gap-[0.15rem] font-semibold",
  offerTags: "font-mono text-[0.75rem] font-normal text-ink-soft",
  offerPrice: "font-mono text-[1.05rem] font-medium tabular-nums",
  // "Show N more": one centered button across the row
  moreRow: "grid justify-center py-1",
  // the price list's filters: big stores only, new only
  filterRow: "flex flex-wrap justify-center gap-x-6 gap-y-1 py-1",
  // a volume not out yet: when it's out and where to preorder it
  preorder:
    "flex flex-col gap-3 border-[1.5px] border-line bg-card px-4 py-4 text-[0.95rem] text-ink-soft shadow-ink scroll-mt-24 [&_b]:font-semibold [&_b]:text-ink",
  // Amazon, Bookshop.org and eBay side by side; stacked on phones
  preorderButtons:
    "flex flex-wrap gap-3 upto-520:flex-col upto-520:[&>a]:w-full",
  note: "border-[1.5px] border-dashed border-line-soft px-4 py-[0.85rem] text-[0.95rem] text-ink-soft [&_.btn]:mt-3 [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-accent [&_a]:underline-offset-3",
  // price history: a row per kind of copy (new print, used & marketplace,
  // ebook), its label beside lowest / highest / median; on phones the
  // label sits above the three numbers
  history:
    "mb-[0.4rem] border-[1.5px] border-line-soft bg-card [&>div+div]:border-t [&>div+div]:border-dashed [&>div+div]:border-line-soft",
  historyRow:
    "grid grid-cols-[10.5rem_minmax(0,1fr)] items-center gap-4 px-[0.85rem] py-[0.7rem] upto-720:grid-cols-1 upto-720:gap-2 [&>span]:justify-self-start",
  historyStats:
    "grid grid-cols-3 gap-3 [&_dd]:font-mono [&_dd]:text-[1.05rem] [&_dd]:tabular-nums [&_dt]:font-mono [&_dt]:text-[0.75rem] [&_dt]:text-muted",
  // the date and store under a price; a long store name is cut short
  // (its full name is the tooltip)
  statDate: "font-mono text-[0.75rem]! leading-[1.35] text-muted",
  statStore: "truncate font-mono text-[0.75rem]! leading-[1.35] text-muted",
  storeLinks: storeButtons,
  disclosure:
    "mt-3 max-w-[62ch] text-[0.78rem] leading-normal text-muted italic",
  amazonDisclosure: "mt-10 text-right text-[0.75rem] text-muted",
  volumeActions: "mt-1 flex flex-wrap items-center gap-[0.85rem]",
  // stores with no price, tucked under the list they belong with
  otherStores: "mt-3",
  otherStoresTitle: "mb-2 font-body text-[0.92rem] font-normal text-ink-soft",
  // the price history: open to start with, and its heading folds it shut
  historyFold: "group/fold",
  historySummary:
    "flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 [&_h2]:mb-0 [&::-webkit-details-marker]:hidden [&_svg]:ml-auto [&_svg]:size-5 [&_svg]:transition-transform [&_svg]:duration-150 group-open/fold:[&_svg]:rotate-180 group-open/fold:mb-3",
  // the shelf button's pieces join the action row: its state line above,
  // its undo note below
  shelfAction: "contents",
  shelfState:
    "-order-1 -mb-[0.35rem] basis-full font-mono text-[0.8rem] text-muted [&_a]:text-ink-soft [&_a]:underline [&_a]:decoration-line-soft [&_a]:underline-offset-3 [&_a]:hover:text-accent",
  shelfNote: "order-1 basis-full text-[0.88rem] text-ink-soft empty:hidden",
  undoBtn: "font-semibold text-accent underline underline-offset-3",
  // holds the button's place while we check the shelf
  shelfPending: "pointer-events-none opacity-55",
  // a series not on the shelf yet: to-read, "I own Vol. 2" and "+ To buy",
  // side by side. Beside a phone's cover there's no room for three in a
  // line, and three stacked pushed the prices down: there, to-read takes
  // the column's width and the other two share the row under it, all a
  // full finger tall. (Lines of words, and a To buy button with no "I own"
  // beside it, take a whole row.)
  shelfChoices:
    "flex flex-wrap items-center gap-3 upto-720:grid upto-720:w-full upto-720:grid-cols-2 upto-720:gap-2 upto-720:[&_.btn]:h-11 upto-720:[&_.btn]:w-full upto-720:[&_.btn]:px-2 upto-720:[&>p]:col-span-2 upto-720:[&>button:nth-child(2)]:col-span-2",
  // the one button of a series on the shelf, full size like "+ To buy"
  // beside it: on a phone it shares its row with that, or fills the row
  // when it's alone
  shelfButton:
    "upto-720:min-w-0 upto-720:flex-1 upto-720:basis-0 upto-720:px-1 upto-720:text-[0.875rem]",
  // "+ To buy" beside it, the same height
  shelfMore:
    "flex flex-wrap items-center gap-3 upto-720:min-w-0 upto-720:flex-1 upto-720:basis-0 upto-720:gap-y-1 upto-720:[&_.btn]:h-11 upto-720:[&_.btn]:w-full upto-720:[&_.btn]:px-2 upto-720:[&_.btn]:text-[0.875rem]",
  siblings: "mt-10 border-t-[1.5px] border-dashed border-line-soft pt-6",

  // ---------- shared by series and volume pages ----------
  backToNew:
    "tap mb-3 inline-flex items-center gap-1 font-medium underline decoration-accent decoration-2 underline-offset-3 [&_svg]:size-4",
  crumbs:
    "mb-5 flex flex-wrap items-center gap-[0.45rem] text-[0.85rem] text-muted [.prices-page_&]:-mb-3 [&_[aria-current]]:text-ink-soft [&_a]:underline-offset-3 [&_a]:hover:text-ink [&_a]:hover:underline",
  tag: "mr-[0.4rem] inline-block rounded-[2px] border border-line-soft px-[0.45rem] py-[0.05rem]",
  partOf:
    "text-[0.92rem] text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:decoration-line-soft [&_a]:underline-offset-3 [&_a]:hover:decoration-current",
  textBtn: `tap text-[0.85rem] text-ink-soft ${softLink} hover:text-ink hover:decoration-current`,
  facts: "flex flex-col gap-[0.6rem]",
  factRow:
    "flex flex-wrap gap-x-5 gap-y-[0.35rem] text-[0.88rem] text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink [&_a]:underline [&_a]:decoration-line-soft [&_a]:underline-offset-3",
  genres:
    "flex flex-wrap gap-[0.35rem] [&_li]:rounded-[2px] [&_li]:border-[1.5px] [&_li]:border-line-soft [&_li]:px-2 [&_li]:py-[0.05rem] [&_li]:text-[0.78rem] [&_li]:text-ink-soft",
  blurb:
    "max-w-[68ch] text-[0.95rem] leading-[1.6] whitespace-pre-line text-ink-soft",
  clamped: "line-clamp-3",

  // ---------- series page ----------
  // cover, words, and (when the series has any) its box sets at the right;
  // under the two on anything narrower than a laptop
  seriesHead:
    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-[clamp(1.25rem,4vw,2.5rem)] upto-980:grid-cols-[auto_minmax(0,1fr)]",
  // box sets: an inked box like the shelf's "Buy it"; a plain row of tickets
  // to swipe on a tablet; on a phone they stack, each the screen's width, so
  // no store name or price is cut off at the edge
  setsBox:
    "w-[15.5rem] min-w-0 border-2 border-line bg-card p-3 shadow-ink-lg upto-980:col-span-full upto-980:w-auto upto-980:border-0 upto-980:border-t-[1.5px] upto-980:border-dashed upto-980:border-line-soft upto-980:bg-transparent upto-980:px-0 upto-980:pt-4 upto-980:pb-0 upto-980:shadow-none",
  setsTitle:
    "mb-[0.6rem] font-brand text-[1.4rem] leading-none font-normal tracking-[1px] uppercase",
  // the title, and beside it (below a laptop) which of the series' sets and
  // editions is showing: the shelf's "Buy next · as 3-in-1" head
  setsHead:
    "mb-[0.6rem] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 [&_h2]:mb-0",
  setsPickInline: "hidden upto-980:inline-flex",
  // on a laptop the pick is a box of its own under the title
  setsPickBox: "mb-2.5 upto-980:hidden",
  // the ones not showing: a quiet row each, with its cheapest price
  setsOthers: "mt-3 border-t-[1.5px] border-dashed border-line-soft pt-1.5",
  setsOther:
    "tap flex min-h-9 w-full items-baseline justify-between gap-3 text-left text-[0.9rem] font-medium text-ink-soft transition-colors duration-120 ease-[ease] hover:text-accent upto-720:min-h-11",
  setsOtherName: "underline decoration-line-soft underline-offset-3",
  setsList:
    "flex flex-col gap-2 upto-980:flex-row upto-980:overflow-x-auto upto-980:pb-1 upto-980:[scrollbar-width:none] upto-560:flex-col upto-560:overflow-visible",
  setTicket:
    "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-ink border-[1.5px] border-dashed border-line bg-paper px-3 py-[0.45rem] text-[0.92rem] font-semibold transition-[background-color,border-color] duration-120 ease-[ease] [a&]:hover:border-accent [a&]:hover:bg-accent-wash upto-980:w-[11rem] upto-980:shrink-0 upto-560:w-auto",
  setTicketFirst:
    "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-ink border-2 border-accent bg-accent-wash px-3 py-[0.45rem] text-[0.92rem] font-semibold shadow-[3px_3px_0_var(--hard-shadow)] transition-[translate,box-shadow] duration-120 ease-[ease] [a&]:hover:-translate-y-px [a&]:hover:shadow-[4px_4px_0_var(--hard-shadow)] upto-980:w-[11rem] upto-980:shrink-0 upto-560:w-auto",
  setKind:
    "col-span-full font-mono text-[0.72rem] font-normal tracking-[0.06em] whitespace-nowrap text-muted uppercase",
  setKindFirst:
    "col-span-full font-mono text-[0.72rem] font-medium tracking-[0.06em] whitespace-nowrap text-accent-ink uppercase",
  setStore: "min-w-0 truncate",
  setPrice: "text-right font-mono font-medium text-accent-ink",
  // the box draws its sets two ways: a ticket and a price list in the
  // narrow box on a laptop, every set a ticket below it
  setsOnLaptop: "upto-980:hidden",
  setsBelowLaptop: "hidden upto-980:block",
  // the sets after the cheapest: a price list, a line each. New or used
  // first (the store is often the same four times), then the store, and
  // the price at the right
  setRows: "mt-1.5",
  setRow:
    "grid min-h-9 grid-cols-[4.2rem_minmax(0,1fr)_auto] items-baseline gap-x-2 border-b border-dashed border-line-soft py-1.5 text-[0.9rem] font-medium transition-colors duration-120 ease-[ease] [a&]:hover:text-accent upto-720:min-h-11 upto-720:items-center",
  setRowKind:
    "font-mono text-[0.72rem] font-normal tracking-[0.06em] whitespace-nowrap text-muted uppercase",
  setsMore: "mt-2",
  setsMoreSummary:
    "tap cursor-pointer py-1 text-right text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 marker:content-none hover:text-accent hover:decoration-accent [&::-webkit-details-marker]:hidden upto-980:text-left",
  // where else to look. In the laptop's narrow box, plain links that wrap
  // like a line of text (as boxes they broke one to a line, each a different
  // width); below it, where there's the width, the same boxes as before
  setStores:
    "mt-2 flex flex-wrap gap-x-3.5 gap-y-1 upto-980:grid upto-980:grid-cols-4 upto-980:gap-1.5 upto-560:grid-cols-2 [&_a]:tap [&_a]:text-[0.85rem] [&_a]:font-medium [&_a]:underline [&_a]:decoration-line-soft [&_a]:underline-offset-3 [&_a]:transition-[background-color,color] [&_a]:duration-120 [&_a]:ease-[ease] [&_a]:hover:text-accent upto-980:[&_a]:block upto-980:[&_a]:rounded-[2px] upto-980:[&_a]:border-[1.5px] upto-980:[&_a]:border-line upto-980:[&_a]:bg-paper upto-980:[&_a]:px-[0.6rem] upto-980:[&_a]:py-[0.25rem] upto-980:[&_a]:text-center upto-980:[&_a]:text-[0.82rem] upto-980:[&_a]:no-underline upto-980:[&_a]:hover:bg-ink upto-980:[&_a]:hover:text-paper",
  // the edition box's one ticket: the row's whole width on a phone
  editionsBoxTicket:
    "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-ink border-2 border-accent bg-accent-wash px-3 py-[0.45rem] text-[0.92rem] font-semibold shadow-[3px_3px_0_var(--hard-shadow)] transition-[translate,box-shadow] duration-120 ease-[ease] [a&]:hover:-translate-y-px [a&]:hover:shadow-[4px_4px_0_var(--hard-shadow)]",
  // its second book: the plain ticket, sharing the row on a phone
  editionsBoxTicketPlain:
    "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-ink border-[1.5px] border-dashed border-line bg-paper px-3 py-[0.45rem] text-[0.92rem] font-semibold transition-[background-color,border-color] duration-120 ease-[ease] [a&]:hover:border-accent [a&]:hover:bg-accent-wash",
  // two books: stacked in the box, side by side below a laptop
  editionsBoxList: "flex flex-col gap-2 upto-980:flex-row upto-520:flex-col",
  // "vols. 7–9" under a book's name
  editionsBoxInside:
    "col-span-full font-mono text-[0.78rem] font-normal text-ink-soft",
  // the app's strong text link (ink, a red underline), on a line of its own
  // at the box's right; a full thumb's height on a phone
  editionsBoxAll:
    "tap mt-2 flex min-h-9 items-center justify-end gap-1 text-[0.92rem] font-semibold text-ink underline decoration-accent decoration-2 underline-offset-3 transition-colors duration-120 ease-[ease] hover:text-accent upto-980:justify-start upto-720:min-h-11",
  // "Looking for a box set? Try [stores]": a quiet row at the foot of the page
  setSearch: "mt-10",
  setSearchTitle: "mb-2 font-body text-[0.92rem] font-normal text-ink-soft",
  setSearchStores: storeButtons,
  setDisclosure: "mt-2 text-[0.72rem] leading-snug text-muted italic",
  seriesCover:
    "aspect-2/3 w-[clamp(110px,16vw,180px)] border-[1.5px] border-line object-cover shadow-[6px_6px_0_var(--hard-shadow)] upto-720:w-24",
  // around the series' cover, for the readers' score badge on its corner
  seriesCoverBox: "relative block shrink-0 self-start",
  seriesCopy: "flex min-w-0 flex-col gap-[0.9rem]",

  // ---------- series index ----------
  indexHead: "flex flex-col gap-3",
  indexControls: "mt-1 flex flex-wrap items-center gap-x-6 gap-y-3",
  // two inked tabs, the pressed one filled
  segmented:
    "inline-flex overflow-hidden rounded-ink border-2 border-line [&_button]:min-h-11 [&_button]:bg-card [&_button]:px-4 [&_button]:text-[0.92rem] [&_button]:font-medium [&_button]:text-ink-soft [&_button]:transition-[background-color,color] [&_button]:duration-120 [&_button]:ease-[ease] [&_button]:hover:text-ink [&_button+button]:border-l-2 [&_button+button]:border-line [&_button[aria-pressed=true]]:bg-ink [&_button[aria-pressed=true]]:text-paper",
  genrePick: "flex items-center gap-2 text-[0.875rem] text-muted [&>div]:w-48",
  // A to Z: a jump bar, then one block per letter
  letterBar:
    "flex flex-wrap gap-1 [&_a]:grid [&_a]:h-[34px] [&_a]:min-w-[34px] upto-720:[&_a]:h-11 upto-720:[&_a]:min-w-11 [&_a]:place-items-center [&_a]:rounded-[2px] [&_a]:border-[1.5px] [&_a]:border-line-soft [&_a]:font-brand [&_a]:text-[1.1rem] [&_a]:text-ink-soft [&_a]:transition-[border-color,color] [&_a]:duration-120 [&_a]:ease-[ease] [&_a]:hover:border-line [&_a]:hover:text-accent",
  letterGroup: "scroll-mt-4",
} as const;

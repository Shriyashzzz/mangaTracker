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

export const pricesStyles = {
  // ---------- price home + search ----------
  page: "prices-page flex flex-col gap-8",
  searchHead: "speed-burst flex flex-col gap-3 border-3 border-line p-[clamp(1.25rem,3vw,2rem)]",
  title:
    "font-brand text-[clamp(2.4rem,6vw,3.6rem)] leading-[0.95] font-normal tracking-[0.02em] uppercase",
  sub: "text-[1.05rem] text-ink-soft",
  // on phones the dropdown spans the whole search row, not just the input
  searchForm: "mt-2 flex gap-3 upto-720:relative upto-720:[&>.btn]:px-[1.1rem]",
  comboWrap: "relative min-w-0 flex-1 upto-720:static",
  suggestions:
    "absolute inset-x-0 top-[calc(100%+6px)] z-20 border-[2.5px] border-line bg-card p-[0.35rem] shadow-[0_12px_28px_-12px_rgba(0,0,0,0.45)]",
  suggestion: `${suggestionRow} px-[0.55rem] py-[0.45rem]`,
  suggestActive: "bg-paper-2",
  suggestThumb:
    "aspect-2/3 w-[34px] shrink-0 overflow-hidden border border-line-soft bg-paper-2 [&_img]:size-full [&_img]:object-cover",
  suggestText: "flex min-w-0 flex-col",
  suggestName: "truncate font-semibold",
  suggestMeta: "font-mono text-[0.72rem] text-muted",
  suggestNote: "px-[0.55rem] py-[0.6rem] text-[0.9rem] text-muted",
  // the last row: "See all results"
  seeAll: `${suggestionRow} mt-1 justify-center border-t border-dashed border-line-soft p-[0.6rem] text-[0.9rem] font-medium text-ink-soft`,
  searchBox:
    "flex h-[50px] w-full min-w-0 items-center gap-[0.6rem] border-[2.5px] border-line bg-paper px-4 text-muted focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-wash)] [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-none [&_input]:bg-transparent [&_input]:text-[1.05rem] [&_input]:text-ink [&_input]:outline-none [&_input]:placeholder:text-muted [&_svg]:size-[19px] [&_svg]:shrink-0",
  // "Try: One Piece, Jujutsu Kaisen, ..."
  quick:
    "flex flex-wrap items-center gap-2 text-[0.85rem] text-muted [&_a]:rounded-[2px] [&_a]:border-[1.5px] [&_a]:border-line-soft [&_a]:bg-paper [&_a]:px-[0.65rem] [&_a]:py-[0.2rem] [&_a]:text-[0.85rem] [&_a]:text-ink-soft [&_a]:transition-[border-color] [&_a]:duration-120 [&_a]:ease-[ease] [&_a]:hover:border-line [&_a]:hover:text-ink",
  // inside a results section the count sits above the grid, not overlapping
  count: "-mb-4 font-mono text-[0.78rem] text-muted [section>&]:mb-[0.9rem]",

  // ---------- cards ----------
  grid: "grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-7 upto-720:grid-cols-2 upto-720:gap-x-4 upto-720:gap-y-6",
  card: "group flex flex-col gap-[0.35rem] focus-visible:outline-none",
  // covers lean as if pulled off the shelf, each a little differently. The
  // image sits over a drawn placeholder (coverFallback)
  cover:
    "relative block aspect-2/3 overflow-hidden border-[1.5px] border-line bg-paper-2 shadow-ink-lg transition-[translate,rotate,box-shadow] duration-200 ease-ink group-hover:-translate-x-0.5 group-hover:-translate-y-[3px] group-hover:-rotate-1 group-hover:shadow-[6px_7px_0_var(--hard-shadow)] group-focus-visible:outline-2 group-focus-visible:outline-offset-3 group-focus-visible:outline-accent group-focus-visible:outline-dashed [li:nth-child(3n+2)>.group:hover_&]:rotate-[0.8deg] [&>img]:relative [&>img]:size-full [&>img]:object-cover [&>img]:transition-opacity [&>img]:duration-350 [&>img]:ease-ink",
  coverFallback:
    "cover-lines absolute inset-0 grid place-items-center font-brand text-[3rem] text-muted upto-720:text-[2rem]",
  // the series cover standing in for a missing volume cover; the drawn
  // number shows again if it fails too
  seriesFallback: "absolute inset-0 size-full object-cover",
  // the volume number as a tab on the top corner, readable at a glance even
  // when several volumes share the series cover
  vol: "absolute top-0 left-0 flex items-baseline gap-[0.2rem] bg-ink pt-[0.2rem] pr-[0.85rem] pb-[0.1rem] pl-2 font-brand text-[1.5rem] leading-none tracking-[0.02em] text-paper [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)] [&_small]:text-[0.62rem] [&_small]:tracking-[0.08em] [&_small]:uppercase",
  cardTitle: "line-clamp-2 text-[0.92rem] leading-[1.3] font-semibold",
  cardMeta: "text-[0.8rem] text-muted",
  cardPrice: "flex items-baseline gap-[0.4rem] font-mono text-[0.9rem] font-medium",
  cardWas: "text-[0.75rem] font-normal text-muted",
  cardSkeleton: "aspect-2/3",
  // a horizontal shelf of cards, scrolls sideways when it runs long
  row: "grid snap-x snap-proximity auto-cols-[132px] grid-flow-col gap-5 overflow-x-auto pb-[0.6rem] [scrollbar-color:var(--line-soft)_transparent] [scrollbar-width:thin] [&>li]:snap-start",

  // ---------- empty and error states ----------
  empty:
    "mx-auto my-4 flex max-w-[460px] flex-col items-center gap-[0.6rem] border-[1.5px] border-dashed border-line-soft p-8 text-center text-ink-soft",
  emptyActions: "mt-2 flex flex-wrap justify-center gap-3",
  emptyTitle: "font-display text-[1.5rem] font-semibold text-ink",
  promo:
    "prices-promo flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-[1.5px] border-dashed border-line-soft px-6 py-5",
  promoBody: "max-w-[46ch] text-ink-soft",

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
  bestLine:
    "mt-[0.35rem] font-display text-[1.35rem] text-ink-soft upto-720:text-[1.1rem] [&_strong]:font-semibold [&_strong]:text-ink",
  volumeBody:
    "col-start-2 row-start-2 flex min-w-0 flex-col gap-6 upto-720:col-span-2 upto-720:col-start-1",
  // Bangers heading with a short inked stroke underneath
  sectionTitle:
    "mb-[0.6rem] inline-block bg-[linear-gradient(var(--accent),var(--accent))] bg-size-[1.8em_3px] bg-left-bottom bg-no-repeat pb-[0.2rem] font-brand text-[1.45rem] font-normal tracking-[0.03em] uppercase [.prices-promo_&]:mb-1",
  sectionHead: "mb-3 flex flex-col items-start justify-between gap-4",
  live_info: "flex items-start justify-center gap-4",
  sectionNote: "-mt-[0.2rem] max-w-[48ch] text-[medium] leading-[1.35] text-muted",
  checked: "font-mono text-[0.72rem] text-muted",
  // the price list; phones put each store's link on its own line
  offers:
    "border-2 border-line bg-card [&_li]:grid [&_li]:grid-cols-[minmax(0,1fr)_auto_auto] [&_li]:items-center [&_li]:gap-5 [&_li]:px-4 [&_li]:py-[0.7rem] [&_li+li]:border-t [&_li+li]:border-dashed [&_li+li]:border-line-soft [&_a]:text-[0.88rem] [&_a]:underline [&_a]:decoration-line-soft [&_a]:underline-offset-3 [&_a]:hover:decoration-current upto-720:[&_li]:grid-cols-[minmax(0,1fr)_auto] upto-720:[&_li]:gap-x-4 upto-720:[&_li]:gap-y-1 upto-720:[&_a]:col-span-full",
  // the overall cheapest copy's row gets a wash
  lowestOffer: "bg-accent-wash",
  // the store name with its stamps; stamps wrap under a long name
  offerName: "flex flex-wrap items-center gap-x-2 gap-y-[0.3rem]",
  // stamps: the "low" ones are tilted marker stickers with an ink shadow,
  // red for the overall lowest; "Ebook" is a flat label, a format, not a prize
  stampLowest:
    "inline-block -rotate-2 rounded-[2px] border-[1.5px] border-line bg-accent px-[0.4rem] pt-[0.1rem] font-brand text-[1rem] leading-[1.15] font-normal tracking-[1px] text-on-accent uppercase shadow-[2px_2px_0_var(--hard-shadow)]",
  stampNew:
    "inline-block rotate-1 rounded-[2px] border-[1.5px] border-line bg-stamp-new px-[0.4rem] pt-[0.1rem] font-brand text-[1rem] leading-[1.15] font-normal tracking-[1px] text-stamp-ink uppercase shadow-[2px_2px_0_var(--hard-shadow)]",
  stampMarket:
    "inline-block -rotate-1 rounded-[2px] border-[1.5px] border-line bg-stamp-market px-[0.4rem] pt-[0.1rem] font-brand text-[1rem] leading-[1.15] font-normal tracking-[1px] text-stamp-ink uppercase shadow-[2px_2px_0_var(--hard-shadow)]",
  stampEbook:
    "inline-block rounded-[2px] border-[1.5px] border-line bg-stamp-ebook px-[0.4rem] pt-[0.1rem] font-brand text-[1rem] leading-[1.15] font-normal tracking-[1px] text-stamp-ink uppercase",
  offerStore: "flex flex-col gap-[0.15rem] font-semibold",
  offerTags: "font-mono text-[0.72rem] font-normal text-muted",
  offerPrice: "font-mono text-[1.05rem] font-medium tabular-nums",
  // "Show N more": one centered button across the row
  moreRow: "justify-center grid-cols-[auto]!",
  note: "border-[1.5px] border-dashed border-line-soft px-4 py-[0.85rem] text-[0.95rem] text-ink-soft [&_.btn]:mt-3 [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-accent [&_a]:underline-offset-3",
  // all-time low / high / average / median; two by two on phones
  stats:
    "mb-[0.4rem] grid grid-cols-4 border-[1.5px] border-line-soft upto-720:grid-cols-2 [&_dd]:font-mono [&_dd]:text-[1.05rem] [&_dd]:tabular-nums [&_dt]:font-mono [&_dt]:text-[0.7rem] [&_dt]:text-muted [&>div]:px-[0.85rem] [&>div]:py-[0.6rem] [&>div+div]:border-l [&>div+div]:border-dashed [&>div+div]:border-line-soft upto-720:[&>div:nth-child(3)]:border-l-0 upto-720:[&>div:nth-child(n+3)]:border-t",
  statDate: "font-mono text-[0.68rem]! text-muted",
  storeLinks:
    "flex flex-wrap gap-2 [&_a]:inline-block [&_a]:rounded-[2px] [&_a]:border-[1.5px] [&_a]:border-line [&_a]:bg-card [&_a]:px-[0.8rem] [&_a]:py-[0.35rem] [&_a]:text-[0.88rem] [&_a]:font-medium [&_a]:transition-[background-color,color] [&_a]:duration-120 [&_a]:ease-[ease] [&_a]:hover:bg-ink [&_a]:hover:text-paper",
  disclosure: "-mt-3 max-w-[62ch] text-[0.78rem] leading-normal text-muted italic",
  amazonDisclosure: "mt-10 text-right text-[0.75rem] text-muted",
  volumeActions: "flex flex-wrap items-center gap-[0.85rem]",
  // the shelf button's pieces join the action row: its state line above,
  // its undo note below
  shelfAction: "contents",
  shelfState: "-order-1 -mb-[0.35rem] basis-full font-mono text-[0.8rem] text-muted [&_a]:text-ink-soft [&_a]:underline [&_a]:decoration-line-soft [&_a]:underline-offset-3 [&_a]:hover:text-accent",
  shelfNote: "order-1 basis-full text-[0.88rem] text-ink-soft empty:hidden",
  undoBtn: "font-semibold text-accent underline underline-offset-3",
  // holds the button's place while we check the shelf
  shelfPending: "pointer-events-none opacity-55",
  siblings: "mt-10 border-t-[1.5px] border-dashed border-line-soft pt-6",

  // ---------- shared by series and volume pages ----------
  crumbs:
    "mb-5 flex flex-wrap items-center gap-[0.45rem] text-[0.85rem] text-muted [.prices-page_&]:-mb-3 [&_[aria-current]]:text-ink-soft [&_a]:underline-offset-3 [&_a]:hover:text-ink [&_a]:hover:underline",
  tag: "mr-[0.4rem] inline-block rounded-[2px] border border-line-soft px-[0.45rem] py-[0.05rem]",
  partOf: "text-[0.92rem] text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:decoration-line-soft [&_a]:underline-offset-3 [&_a]:hover:decoration-current",
  textBtn: `text-[0.85rem] text-ink-soft ${softLink} hover:text-ink hover:decoration-current`,
  facts: "flex flex-col gap-[0.6rem]",
  factRow: "flex flex-wrap gap-x-5 gap-y-[0.35rem] text-[0.88rem] text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink [&_a]:underline [&_a]:decoration-line-soft [&_a]:underline-offset-3",
  genres:
    "flex flex-wrap gap-[0.35rem] [&_li]:rounded-[2px] [&_li]:border-[1.5px] [&_li]:border-line-soft [&_li]:px-2 [&_li]:py-[0.05rem] [&_li]:text-[0.78rem] [&_li]:text-ink-soft",
  blurb: "max-w-[68ch] text-[0.95rem] leading-[1.6] whitespace-pre-line text-ink-soft",
  clamped: "line-clamp-3",

  // ---------- series page ----------
  seriesHead: "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[clamp(1.25rem,4vw,2.5rem)]",
  seriesCover:
    "aspect-2/3 w-[clamp(110px,16vw,180px)] border-[1.5px] border-line object-cover shadow-[6px_6px_0_var(--hard-shadow)] upto-720:w-24",
  seriesCopy: "flex min-w-0 flex-col gap-[0.9rem]",

  // ---------- series index ----------
  indexHead: "flex flex-col gap-3",
  indexControls: "mt-1 flex flex-wrap items-center gap-x-6 gap-y-3",
  // two inked tabs, the pressed one filled
  segmented:
    "inline-flex overflow-hidden rounded-ink border-2 border-line [&_button]:min-h-10 [&_button]:bg-card [&_button]:px-4 [&_button]:text-[0.92rem] [&_button]:font-medium [&_button]:text-ink-soft [&_button]:transition-[background-color,color] [&_button]:duration-120 [&_button]:ease-[ease] [&_button]:hover:text-ink [&_button+button]:border-l-2 [&_button+button]:border-line [&_button[aria-pressed=true]]:bg-ink [&_button[aria-pressed=true]]:text-paper",
  genrePick:
    "flex items-center gap-2 text-[0.875rem] text-muted [&_select]:min-h-10 [&_select]:rounded-ink [&_select]:border-[1.5px] [&_select]:border-line [&_select]:bg-card [&_select]:px-[0.6rem] [&_select]:text-[16px] [&_select]:text-ink",
  // A to Z: a jump bar, then one block per letter
  letterBar:
    "flex flex-wrap gap-1 [&_a]:grid [&_a]:h-[34px] [&_a]:min-w-[34px] [&_a]:place-items-center [&_a]:rounded-[2px] [&_a]:border-[1.5px] [&_a]:border-line-soft [&_a]:font-brand [&_a]:text-[1.1rem] [&_a]:text-ink-soft [&_a]:transition-[border-color,color] [&_a]:duration-120 [&_a]:ease-[ease] [&_a]:hover:border-line [&_a]:hover:text-accent",
  letterGroup: "scroll-mt-4",
} as const;

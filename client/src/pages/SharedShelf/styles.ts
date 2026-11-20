// Someone's shared shelf (SharedShelf.tsx): their name and what's on it, the
// series in Reading / Finished / To read, and a sheet with the volumes they
// own when one is tapped
export const shareStyles = {
  page: "flex flex-col gap-8 upto-520:gap-6",

  // who, how much, and the link to pass on
  // name and numbers, the fan beside them, the links under the fan; on
  // phones the fan comes first, then the name
  head: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-5 border-b-[1.5px] border-line pb-7 upto-720:grid-cols-[minmax(0,1fr)_auto] upto-720:gap-x-3 upto-720:gap-y-4 upto-720:pb-6",
  who: "flex min-w-0 items-center gap-4 upto-720:col-span-2",
  art: "w-20 shrink-0 upto-520:w-14",
  name: "font-brand text-[2.4rem] leading-none font-normal tracking-[0.02em] text-balance uppercase upto-520:text-[1.9rem]",
  // the shelf in numbers, as one line of print
  tally:
    "mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.8rem] text-ink-soft [&_b]:font-semibold [&_b]:text-ink",
  // each number with a square of its colour: the status inks the page uses
  tallyItem:
    "inline-flex items-center gap-1.5 before:size-2.5 before:border-[1.5px] before:border-line before:bg-(--dot)",
  // on a phone: stacked beside the covers, small (they're for passing the
  // link on, not what a visitor came for), so the list starts a row higher
  actions:
    "col-start-1 flex flex-wrap gap-2.5 upto-720:col-start-2 upto-720:row-start-2 upto-720:flex-col upto-720:justify-center upto-720:gap-2",
  actionsRow: "col-start-1 flex flex-wrap gap-2.5 upto-720:col-span-2",
  view: "tap h-9 px-3 text-ink-soft hover:bg-paper-2 hover:text-ink upto-520:h-10",
  viewOn: "tap h-9 bg-ink px-3 font-semibold text-paper upto-520:h-10",
  // fanned covers: tilted from the middle, straightened and lifted on hover
  fan: "relative isolate col-start-2 row-span-2 row-start-1 flex items-end justify-center pr-2 pl-8 before:absolute before:-inset-x-6 before:-inset-y-5 before:-z-1 before:bg-[radial-gradient(color-mix(in_srgb,var(--accent)_45%,transparent)_1.5px,transparent_1.7px)] before:bg-size-[8px_8px] before:[mask-image:radial-gradient(closest-side,black_55%,transparent)] upto-720:col-start-1 upto-720:row-span-1 upto-720:row-start-2 upto-720:justify-start upto-720:pl-3 upto-720:before:hidden",
  fanItem:
    "-ml-8 rotate-(--tilt) transition-[rotate,translate] duration-200 ease-ink first:ml-0 nth-[2]:translate-y-1 nth-[4]:translate-y-1 hover:z-[2] hover:-translate-y-2 hover:rotate-0 focus-within:z-[2] upto-720:-ml-2.5 upto-720:rotate-[calc(var(--tilt)/2)]",
  fanCard:
    "block cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent focus-visible:outline-dashed",
  fanCover:
    "relative aspect-2/3 w-[6.5rem] border-[1.5px] border-line bg-paper-2 shadow-ink-lg upto-720:w-[3.4rem] upto-720:shadow-ink",
  action:
    "btn btn-secondary gap-2 [&_svg]:size-4 upto-720:min-h-11 upto-720:px-3 upto-720:py-1.5 upto-720:text-[0.88rem]",

  // "Have some of these too?" (CompareNote.tsx): at the right of the tabs
  // on a laptop, and as the last row under the search on a phone, a little
  // smaller so the three stay on one line
  // (never squeezed or wrapped: the tabs give up width for it instead)
  compareNoteInTabs:
    "ml-auto flex shrink-0 items-center gap-x-2.5 self-center pl-4 whitespace-nowrap upto-980:hidden",
  // (last in the block on a phone, after the order and the genre, which
  // are moved to the end there too)
  compareNoteInTools:
    "hidden items-center justify-end gap-x-1.5 whitespace-nowrap upto-980:flex upto-980:w-full upto-520:order-last upto-520:col-span-2",
  compareAsk:
    "-rotate-2 font-hand text-[1.5rem] leading-none font-medium text-accent upto-520:text-[1.3rem]",
  compareArrow: "w-9 shrink-0 text-accent upto-520:w-7",
  // (dropped on a phone when there's a second button to fit on the line)
  compareArrowWide: "w-9 shrink-0 text-accent upto-520:hidden",
  compareStamp:
    "tap -rotate-1 cursor-pointer border-[1.5px] border-line bg-card px-2.5 pt-1.5 pb-1 font-brand text-[1.1rem] leading-none tracking-[0.04em] text-ink uppercase shadow-[2px_2px_0_var(--hard-shadow)] upto-520:px-2 upto-520:text-[1rem] transition-[translate,box-shadow] duration-150 ease-ink hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--hard-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  // "Start my shelf": the same stamp, inked in, since it's the way on
  compareStampGo:
    "tap -rotate-1 border-[1.5px] border-line bg-accent px-2.5 pt-1.5 pb-1 font-brand text-[1.1rem] leading-none tracking-[0.04em] text-on-accent uppercase shadow-[2px_2px_0_var(--hard-shadow)] transition-[translate,box-shadow] duration-150 ease-ink hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--hard-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed upto-520:px-2 upto-520:text-[1rem]",
  compareStop:
    "tap cursor-pointer text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink",
  // "Show 20 more · 20 of 81", under a long list
  showMore:
    "flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[0.8rem] text-muted",
  // one quiet line above the lists
  hint: "text-[0.92rem] text-ink-soft",
  // one line for the owner, looking at their own shared shelf
  ownerNote:
    "flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-[1.5px] border-dashed border-line-soft px-3.5 py-2 text-[0.92rem] text-ink-soft",
  ownerLinks:
    "flex flex-wrap items-center gap-x-4 gap-y-1 [&_a]:tap [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-accent [&_a]:decoration-2 [&_a]:underline-offset-3",
  // "Save a picture" and its two stamps, Post and Story
  pictureGroup: "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ink-soft",
  pictureStamp: "tap stamp-button",
  ownerAction:
    "tap font-medium text-ink underline decoration-accent decoration-2 underline-offset-3 disabled:opacity-50",

  // the shelf in a few numbers: small boxes, then the genre bar and its key
  numbers: "flex flex-col gap-2.5",
  // a word with no spaces (a 100-letter genre) breaks rather than widening the page
  brag: "flex flex-wrap gap-1.5 text-[0.84rem] text-ink-soft [&>li]:max-w-full [&>li]:wrap-anywhere [&>li]:border-[1.5px] [&>li]:border-line [&>li]:bg-card [&>li]:px-2 [&>li]:py-0.5 [&_b]:font-semibold [&_b]:text-ink",
  genreBar:
    "flex h-3 max-w-[32rem] border-[1.5px] border-line [&>span]:block [&>span]:basis-0",
  genreKey:
    "flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.72rem] text-muted [&>li]:max-w-full [&>li]:wrap-anywhere [&>li]:flex [&>li]:items-center [&>li]:gap-1.5 [&_span]:block [&_span]:size-2",

  // their five-star series, a row to swipe along
  favs: "flex flex-col gap-3",
  favsHead: "flex items-center gap-3",
  favsName:
    "-rotate-1 border-[1.5px] border-line bg-accent px-2.5 pt-1.5 pb-1 font-brand text-[1.3rem] leading-none font-normal tracking-[0.03em] text-on-accent uppercase shadow-[2px_2px_0_var(--hard-shadow)]",
  // (a row that scrolls sideways cuts off whatever hangs below it, so it
  // keeps room under the covers for the name shown on hover, and takes the
  // same room back from the space after it)
  favStrip:
    "-mx-3 -mb-7 flex gap-3.5 overflow-x-auto px-3 pt-1 pb-9 [scrollbar-width:thin]",
  favTile: "flex shrink-0 flex-col items-center gap-1.5",
  favCover:
    "relative aspect-2/3 w-[4.75rem] upto-520:w-[3.6rem] border-[1.5px] border-line bg-paper-2 shadow-ink transition-[translate] duration-200 ease-ink hover:-translate-y-1",
  favStars: "flex gap-px text-star [&_svg]:size-2.5",

  // the tabs: a stamp for each list, with its count. The open one is inked
  // in its colour and lifted; the others carry their colour as an underline
  // (a tab is 11rem wide on a laptop, where they'd otherwise stretch across
  // the page; the room left at the right holds the offer to compare)
  tabs: "sticky top-0 z-4 -mx-3 flex items-end gap-2 border-b-[1.5px] border-line bg-[var(--surface,var(--paper))] px-3 pt-2.5 pb-3 upto-520:gap-1.5",
  // the marker above the tabs: no height, and the page's gap after it taken
  // back, so its place is exactly where the tabs start
  tabsStart: "-mb-8 upto-520:-mb-6",
  // what's under the tabs: tall enough that a short list doesn't pull the
  // page (and the stuck tabs) back up when it replaces a long one
  lists: "flex min-h-[85dvh] flex-col gap-8 upto-520:gap-6",
  // before any tab is picked: only as tall as what's in it
  listsShort: "flex flex-col gap-8 upto-520:gap-6",
  tab: "tap flex w-[11rem] min-w-0 shrink upto-720:w-auto upto-720:flex-1 cursor-pointer flex-col items-center gap-1 border-[1.5px] border-line bg-card px-1 pt-2 pb-1.5 text-ink-soft shadow-[inset_0_-4px_0_var(--tone)] transition-[translate,rotate,box-shadow,background-color] duration-150 ease-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  tabOn:
    "tap flex w-[11rem] min-w-0 shrink upto-720:w-auto upto-720:flex-1 cursor-pointer flex-col items-center gap-1 border-[1.5px] border-line bg-(--tone) px-1 pt-2 pb-1.5 text-(--stamp-ink) -translate-y-0.5 -rotate-1 shadow-[3px_3px_0_var(--hard-shadow)] transition-[translate,rotate,box-shadow,background-color] duration-150 ease-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  tabName:
    "font-brand text-[1.3rem] leading-none font-normal tracking-[0.03em] uppercase upto-520:text-[1.05rem]",
  tabCount: "font-mono text-[0.74rem] leading-none",

  // "To get": a row that is one link to the next volume's prices
  getCard:
    "group/card -mx-2 grid w-[calc(100%+1rem)] min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3.5 px-2 py-3 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--stamp-get)_35%,transparent)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-dashed",
  getNext:
    "font-brand text-[1.05rem] leading-[1.1] tracking-[0.03em] text-accent uppercase",
  getPrice: "font-mono text-[0.8rem] font-medium text-ink",
  getGo:
    "text-[0.84rem] font-medium underline decoration-accent decoration-2 underline-offset-3",

  // find and order
  // a laptop: one line, the search then the order, the genre and the
  // layout. A phone: the search with the layout beside it, then the order
  // and the genre side by side
  tools:
    "flex flex-wrap items-center gap-3 upto-520:grid upto-520:grid-cols-[minmax(0,1fr)_auto]",
  search:
    "relative flex min-w-0 flex-1 items-center [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:left-3 [&>svg]:size-4 [&>svg]:text-muted",
  searchInput:
    "h-11 w-full max-w-[26rem] border-[1.5px] border-line bg-card pr-3 pl-9 text-[0.95rem] placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed upto-520:max-w-none",
  sorts:
    "flex items-center gap-1 font-mono text-[0.78rem] text-muted upto-520:hidden",
  sort: "tap px-2 py-1.5 text-ink-soft underline decoration-transparent underline-offset-4 hover:text-ink hover:decoration-line-soft",
  sortOn:
    "tap px-2 py-1.5 font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4",
  // the order and the layout, side by side
  controls:
    "flex flex-wrap items-center gap-x-4 gap-y-1 upto-520:order-last upto-520:col-span-2 upto-520:grid upto-520:grid-cols-2 upto-520:gap-x-3",
  sortMenu: "hidden upto-520:block",
  genreMenu: "w-40 upto-520:w-auto",
  views:
    "flex items-stretch border-[1.5px] border-line font-mono text-[0.78rem]",

  // one reading status
  grid: "mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6 gap-y-9 upto-520:grid-cols-2 upto-520:gap-x-4 upto-520:gap-y-7",

  // a series: tap for its sheet
  card: "group/card relative flex w-full min-w-0 cursor-pointer flex-col gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent focus-visible:outline-dashed",
  cover:
    "relative aspect-2/3 border-[1.5px] border-line bg-paper-2 shadow-ink-lg transition-[translate,box-shadow] duration-200 ease-ink group-hover/card:-translate-y-1",
  stamp:
    "absolute top-2.5 right-2 rotate-8 rounded-[3px] border-2 border-accent-hover bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-2 py-[0.15rem] font-brand text-[1rem] leading-[1.2] tracking-[1.5px] text-accent-hover",
  // the first visit's pointer to the first series
  tapMe:
    "pointer-events-none absolute -bottom-3 -left-2 z-[1] -rotate-6 bg-accent px-2 py-0.5 font-brand text-[1rem] leading-[1.3] tracking-[0.06em] text-on-accent shadow-[2px_2px_0_var(--hard-shadow)] animate-drop",
  cardName:
    "line-clamp-2 font-display text-[1.05rem] leading-[1.25] font-semibold group-hover/card:underline group-hover/card:decoration-accent group-hover/card:decoration-2 group-hover/card:underline-offset-3",
  cardMeta: "truncate font-mono text-[0.76rem] text-muted",
  cardVols: "font-mono text-[0.76rem] font-semibold text-ink",

  // compact: a small cover and three short lines, so more fit on a screen
  rows: "mt-2 grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-8 upto-520:grid-cols-[minmax(0,1fr)]",
  row: "relative border-b-[1.5px] border-line-soft",
  // beside the visitor's own shelf: a series they have too, and the button
  // that saves one they don't
  rowOnYours:
    "absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[0.72rem] text-muted",
  onYours: "font-mono text-[0.72rem] text-muted",
  quickAdd:
    "tap absolute top-1/2 right-0 -translate-y-1/2 border-[1.5px] border-line bg-card px-2 py-1.5 text-[0.8rem] font-semibold shadow-[2px_2px_0_var(--hard-shadow)] hover:bg-paper-2 disabled:opacity-50",
  // "I have this", once pressed: inked in, so the ones they've marked stand out
  haveThisOn:
    "tap absolute top-1/2 right-0 -translate-y-1/2 border-[1.5px] border-line bg-ink px-2 py-1.5 text-[0.8rem] font-semibold text-paper shadow-[2px_2px_0_var(--hard-shadow)]",
  // "You both have 12 series…", for a signed-in visitor
  compare:
    "flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-[1.5px] border-line bg-card px-3.5 py-2.5 text-[0.92rem] text-ink-soft shadow-[3px_3px_0_var(--hard-shadow)] [&_b]:font-semibold [&_b]:text-ink",
  compareOnly:
    "flex min-h-11 cursor-pointer items-center gap-2.5 font-medium text-ink [&_input]:size-[18px] [&_input]:accent-[var(--accent)]",
  rowNote: "font-mono text-[0.8rem] text-muted",
  rowCard:
    "group/card relative -mx-2 grid w-[calc(100%+1rem)] min-w-0 cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3.5 px-2 py-3 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--tone)_35%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed upto-520:grid-cols-[3rem_minmax(0,1fr)]",
  rowCardCompared:
    "group/card relative -mx-2 grid w-[calc(100%+1rem)] min-w-0 cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3.5 py-3 pr-24 pl-2 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--tone)_35%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed upto-520:grid-cols-[3rem_minmax(0,1fr)]",
  rowCover:
    "relative aspect-2/3 border-[1.5px] border-line bg-paper-2 shadow-ink transition-[translate] duration-200 ease-ink group-hover/card:-translate-y-0.5",
  rowText: "flex min-w-0 flex-col gap-1",
  rowName:
    "truncate font-display text-[1.02rem] leading-[1.25] font-semibold group-hover/card:underline group-hover/card:decoration-accent group-hover/card:decoration-2 group-hover/card:underline-offset-3",
  // the volumes they own, as ticks; a gap is an empty one
  ticks: "flex h-3 max-w-[15rem] min-w-0 gap-[2px] overflow-hidden",
  tick: "max-w-[7px] min-w-[2px] flex-1 rounded-[1px] bg-[color-mix(in_srgb,var(--tone)_70%,var(--ink))]",
  tickGap:
    "max-w-[7px] min-w-[2px] flex-1 rounded-[1px] border border-dashed border-muted",
  rowMore:
    "flex min-h-[1.2rem] min-w-0 items-center gap-3 font-mono text-[0.76rem] text-muted [&>span:not([class])]:truncate",
  // at the right of the row, level with its middle: at the foot it sat on
  // top of the stars
  rowTapMe:
    "pointer-events-none absolute top-1/2 right-2 z-[1] -translate-y-1/2 -rotate-6 bg-accent px-2 py-0.5 font-brand text-[1rem] leading-[1.3] tracking-[0.06em] text-on-accent shadow-[2px_2px_0_var(--hard-shadow)] animate-drop",
  // "Top pick" with its star: in a row's last line, and on a cover's corner
  topStamp:
    "inline-flex shrink-0 -rotate-2 items-center gap-1 bg-accent px-1.5 pt-0.5 font-brand text-[0.82rem] leading-[1.3] tracking-[0.05em] text-on-accent uppercase shadow-[1.5px_1.5px_0_var(--hard-shadow)] [&_svg]:size-2.5",
  topStampOnCover:
    "absolute top-2 left-1.5 inline-flex -rotate-3 items-center gap-1 bg-accent px-1.5 pt-0.5 font-brand text-[0.9rem] leading-[1.3] tracking-[0.05em] text-on-accent uppercase shadow-[2px_2px_0_var(--hard-shadow)] [&_svg]:size-3",

  nothing: "py-6 text-ink-soft",

  // someone without an account, at the end of the shelf
  // The offer of a shelf of their own, at the end: one panel of the stamp
  // yellow, lettered in ink. The print dots are only in the corner behind
  // Kenji, fading out before they reach the words (under the words they
  // made them hard to read)
  invite:
    "relative isolate grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-5 overflow-hidden border-2 border-(--invite-edge) bg-(--invite-paper) px-6 pt-5 pb-6 text-(--invite-ink) shadow-ink-lg before:absolute before:inset-y-0 before:right-0 before:-z-1 before:w-[55%] before:bg-[radial-gradient(var(--dots-strong)_1.3px,transparent_1.5px)] before:bg-size-[8px_8px] before:[mask-image:linear-gradient(to_left,black_25%,transparent)] upto-520:px-4 upto-520:pt-4 upto-520:pb-5",
  inviteArt: "w-28 shrink-0 self-end upto-520:w-20",
  inviteText: "flex min-w-0 flex-col gap-3.5",
  inviteHead:
    "font-brand text-[1.9rem] leading-[0.95] font-normal tracking-[0.02em] text-balance uppercase upto-520:text-[1.6rem]",
  // each point behind a small ink diamond
  inviteList:
    "flex flex-col gap-1.5 text-[1rem] leading-[1.3] font-medium [&>li]:flex [&>li]:items-baseline [&>li]:gap-2.5 [&>li]:before:size-[0.4rem] [&>li]:before:shrink-0 [&>li]:before:-translate-y-0.5 [&>li]:before:rotate-45 [&>li]:before:bg-current",
  inviteGo: "mt-1 flex flex-wrap items-center gap-x-4 gap-y-2",
  // "It's free", stamped beside the button
  inviteFree:
    "-rotate-3 border-[1.5px] border-current px-2 pt-1 pb-0.5 font-brand text-[1.05rem] leading-none tracking-[0.04em] uppercase",

  // the series sheet: from the bottom on phones, the right on laptops
  sheet:
    // (open:flex, never plain flex: that kept a closed sheet drawn until
    // the page took it away, which showed as a flash without its backdrop.
    // On a phone it's one height whatever it holds: sized to its content,
    // it grew a moment after opening, when the synopsis arrived)
    "fixed m-0 mt-auto ml-auto max-h-none w-[min(30rem,100vw)] flex-col border-l-[2.5px] open:flex border-line bg-card text-ink shadow-ink-lg backdrop:bg-[rgba(20,14,8,0.55)] open:animate-sheet-in from-721:h-dvh upto-720:h-[88dvh] upto-720:w-screen upto-720:max-w-none upto-720:border-t-[2.5px] upto-720:border-l-0 upto-720:open:animate-sheet-up",
  sheetHead:
    "flex items-start justify-between gap-4 border-b-[1.5px] border-line bg-(--tone) bg-[radial-gradient(var(--dots-strong)_1px,transparent_1.2px)] bg-size-[6px_6px] px-5 pt-5 pb-4 text-(--stamp-ink)",
  sheetTitle:
    "font-brand text-[1.7rem] leading-[1.05] font-normal tracking-[0.02em] text-balance uppercase",
  sheetClose:
    "tap -mr-2 grid size-10 shrink-0 place-items-center text-(--stamp-ink) hover:bg-[color-mix(in_srgb,var(--card)_40%,transparent)] [&_svg]:size-4",
  sheetBody: "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5",
  sheetTop: "flex gap-4",
  sheetCover:
    "relative aspect-2/3 w-24 shrink-0 border-[1.5px] border-line bg-paper-2",
  facts:
    "grid content-start grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.9rem] [&_dt]:font-mono [&_dt]:text-[0.74rem] [&_dt]:text-muted [&_dt]:uppercase [&_dt]:self-center",
  label:
    "mb-2 font-brand text-[1.15rem] leading-none tracking-[0.03em] uppercase",
  ranges: "mt-2 font-mono text-[0.8rem] text-ink-soft",
  notes: "leading-[1.55] whitespace-pre-line wrap-anywhere",
  // keeping it: a button, or where it already is on theirs
  // what the series is about: a few lines, the rest behind "Read more"
  synopsis:
    "flex flex-col items-start gap-1 text-[0.92rem] leading-[1.5] text-ink-soft",
  synopsisFolded: "line-clamp-3",
  // while it's being asked for: the height of three lines and "Read more"
  synopsisWaiting: "skeleton h-[6.4rem] opacity-60",
  // underlined in the series' own status colour (the sheet's --tone: yellow
  // for Reading, green for Finished, blue for To read), a little thicker
  // than the other links so a pale ink still shows
  synopsisMore:
    "tap font-medium text-ink underline decoration-(--tone) decoration-[3px] underline-offset-3",
  addLine: "flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem]",
  addLink:
    "tap font-medium underline decoration-accent decoration-2 underline-offset-3",
  sheetFoot:
    "flex flex-wrap gap-2.5 border-t-[1.5px] border-line px-5 py-4 upto-520:[&>*]:flex-1",

  // the volumes they own, as spines on a shelf; a gap stands empty
  spines:
    "flex flex-wrap items-end gap-x-[3px] gap-y-3 border-b-[3px] border-double border-line pb-[3px]",
  spine:
    "grid h-16 w-[22px] place-items-end justify-center border-[1.5px] border-line bg-(--tone) pb-1 font-mono text-[0.62rem] font-semibold text-(--stamp-ink) shadow-[1px_0_0_var(--line)] [writing-mode:vertical-rl] odd:bg-[color-mix(in_srgb,var(--tone)_78%,var(--stamp-ink))]",
  gap: "grid h-12 w-[22px] place-items-end justify-center border-[1.5px] border-dashed border-line-soft pb-1 font-mono text-[0.62rem] text-muted [writing-mode:vertical-rl]",
} as const;

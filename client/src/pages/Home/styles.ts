// Tailwind classes for the shelf page (Home): the signed-in shelf, its
// empty states, and the guest landing (a manga page of three panels).

// a status tab; the active one is inked with a marker on the toolbar rule
const tab = "relative py-[0.2rem] text-[1rem] transition-colors duration-150 ease-[ease]";

// one side of the New tab's volumes / chapters switch
const releaseKind =
  "min-h-11 px-4 font-brand text-[1.15rem] tracking-[1px] whitespace-nowrap transition-colors duration-150 ease-[ease] not-first:border-l-2 not-first:border-line upto-520:flex-1 upto-520:px-2 upto-520:text-[1.05rem]";

// one manga panel of the guest landing
const panel =
  "relative flex flex-col border-3 border-line bg-paper animate-panel-open motion-reduce:animate-none";

export const homeStyles = {
  // ---------- shelf ----------
  pageHead: "mb-7 flex flex-wrap items-center justify-between gap-4",
  pageTitle: "text-[clamp(2.2rem,5vw,3.2rem)]",
  // the header scrolls away, this stays pinned so search and filters are
  // one tap away on a long shelf. It reaches a little past the grid on both
  // sides so tilted cards never peek out beside it while scrolling
  toolbar:
    "sticky top-0 z-5 -mx-3 mb-9 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b-[1.5px] border-line bg-[var(--surface,var(--paper))] px-3 py-[0.9rem] [&+nav]:-mt-4",
  tabs: "flex gap-6 upto-520:gap-3 upto-520:[&_button]:text-[0.92rem]",
  tab: `${tab} text-muted hover:text-ink`,
  tabActive: `${tab} font-semibold text-ink after:absolute after:inset-x-0 after:-bottom-[calc(0.9rem+2.5px)] after:h-1 after:bg-accent`,
  count: "ml-0.5 font-mono text-[0.78rem] font-normal text-muted",
  tools: "flex items-center gap-5 upto-520:w-full upto-520:gap-4",
  // compact until you use it, then it widens; it stays wide while it holds
  // a query. On small phones it takes the row
  search:
    "peer/search flex w-[180px] items-center gap-[0.45rem] border-b-[1.5px] border-dashed border-line-soft py-[0.3rem] text-muted transition-[width,border-color] duration-300 ease-ink focus-within:w-80 focus-within:border-solid focus-within:border-accent has-[input:not(:placeholder-shown)]:w-80 upto-520:w-auto upto-520:flex-1 upto-520:focus-within:w-auto upto-520:has-[input:not(:placeholder-shown)]:w-auto [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-none [&_input]:bg-transparent [&_input]:text-[0.95rem] [&_input]:outline-none [&_input]:placeholder:text-muted [&_svg]:size-4 [&_svg]:shrink-0",
  // while typing on a phone, sort folds away so search gets the whole row
  sort: "flex max-w-[260px] items-center gap-[0.4rem] overflow-hidden text-[0.875rem] whitespace-nowrap text-muted transition-[max-width,opacity] duration-300 ease-ink upto-520:peer-focus-within/search:-ml-4 upto-520:peer-focus-within/search:max-w-0 upto-520:peer-focus-within/search:opacity-0 [&_select]:cursor-pointer [&_select]:border-none [&_select]:bg-transparent [&_select]:text-[0.9rem] [&_select]:font-medium [&_select]:text-ink [&_select]:underline [&_select]:decoration-line-soft [&_select]:underline-offset-4",
  classContainer:
    "grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-9 upto-520:grid-cols-2 upto-520:gap-x-4 upto-520:gap-y-7",
  pagerBottom: "mt-10",
  // the New tab's own switch: new volumes or new chapters, one at a time
  releaseTools:
    "mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-2",
  releaseKinds:
    "flex overflow-hidden rounded-ink border-2 border-line upto-520:w-full",
  releaseKind: `${releaseKind} bg-card text-ink-soft hover:text-ink`,
  releaseKindActive: `${releaseKind} bg-accent text-on-accent`,
  releaseKindCount: "ml-1 font-mono text-[0.78rem] tracking-normal",
  // side info: it should read as a footnote to the switch, not compete with it
  releaseNote: "text-[0.85rem] text-ink-soft",
  // the check's progress, a thin ink line with a small label
  checkBar: "h-[3px] w-full overflow-hidden rounded-full bg-line-soft",
  checkBarFill:
    "h-full bg-ink transition-[width] duration-300 ease-ink motion-reduce:transition-none",
  checkText: "text-[0.85rem] text-ink-soft",
  checkAside: "mt-1 block text-pretty",
  checkInline: "mb-7 flex flex-col gap-1.5",
  checkCentre:
    "mx-auto flex min-h-[34dvh] max-w-[300px] flex-col items-center justify-center gap-2.5 text-center",
  checkTitle: "font-display text-[1.25rem] text-ink-soft",
  // nothing new: a little inked panel, tilted like it was stuck on the page
  nothingNew:
    "mx-auto my-12 max-w-[440px] -rotate-1 rounded-ink border-[2.5px] border-line bg-card px-8 pt-8 pb-3 text-center shadow-ink-lg motion-reduce:rotate-0 upto-520:mx-0 upto-520:rotate-0",
  nothingNewTitle: "font-brand text-[1.9rem] leading-[1.1] tracking-[1px] text-balance",
  skeletonTitle: "mb-10 h-[46px] w-60",

  // ---------- empty states ----------
  emptyState:
    "mx-auto my-12 max-w-[440px] rounded-ink border-[1.5px] border-dashed border-line-soft px-8 py-9 text-center",
  emptyTitle: "font-display text-[1.6rem] font-semibold",
  emptyBody: "mt-2 mb-6 text-ink-soft",

  // ---------- guest landing ----------
  guestContainer:
    "grid grid-cols-[1fr_1.05fr] items-center gap-[clamp(2.5rem,6vw,4.5rem)] py-[clamp(0rem,4vw,2.5rem)] upto-860:grid-cols-[minmax(0,1fr)]",
  guestCopy: "min-w-0",
  guestTitle:
    "font-brand text-[clamp(3rem,7.4vw,5.6rem)] leading-[0.92] font-normal tracking-[0.01em] text-balance uppercase",
  // the hit word gets an ink stamp, like a panel's punchline
  titleHit: "inline-block -rotate-[2.5deg] bg-ink px-[0.12em] text-paper",
  guestActions: "mt-8 flex flex-wrap items-center gap-4",
  // a manga page: white gutters, inked panel borders, slightly askew
  page: "grid rotate-1 grid-cols-[1fr_1fr] gap-3 border-[1.5px] border-line-soft bg-card p-3 upto-860:mx-auto upto-860:w-full upto-860:max-w-[520px] upto-520:rotate-0 upto-520:gap-[9px] upto-520:p-[9px] [&>li:nth-child(2)]:[animation-delay:0.12s] [&>li:nth-child(3)]:[animation-delay:0.24s]",
  panel: `${panel} min-h-[150px]`,
  panelWide: `${panel} col-span-full min-h-[170px]`,
  art: "grid flex-1 place-items-center overflow-hidden",
  // focus lines radiating from the middle of the panel
  speed:
    "bg-[radial-gradient(circle_at_50%_50%,var(--paper)_0_26%,transparent_62%),repeating-conic-gradient(from_0deg_at_50%_50%,var(--line)_0deg_0.7deg,transparent_0.7deg_6deg)]",
  // screentone
  tone: "bg-[radial-gradient(var(--dots-strong)_1.3px,transparent_1.6px)] bg-size-[7px_7px]",
  bigCh:
    "relative bg-paper px-[0.25em] py-[0.05em] font-brand text-[clamp(3.6rem,8vw,5rem)] leading-none tracking-[0.02em] text-ink [&_small]:mr-[0.1em] [&_small]:text-[0.45em] [&_small]:text-muted",
  panelStars: "flex gap-0.5 bg-paper px-2 py-[0.35rem] text-star [&_svg]:size-[26px]",
  // three blank volumes, as if the covers were still loading in
  covers:
    "flex items-end [&>span]:grid [&>span]:aspect-2/3 [&>span]:w-[46px] [&>span]:[place-items:end_center] [&>span]:border-2 [&>span]:border-line [&>span]:bg-card [&>span]:pb-1.5 [&>span]:font-mono [&>span]:text-[0.6rem] [&>span]:text-muted [&>span+span]:-ml-2.5 [&>span:nth-child(1)]:-rotate-8 [&>span:nth-child(2)]:relative [&>span:nth-child(2)]:z-1 [&>span:nth-child(2)]:w-[54px] [&>span:nth-child(2)]:-translate-y-1 [&>span:nth-child(3)]:rotate-7",
  // sound effects break out of the panel border, as they do on the page
  sfx: "pointer-events-none absolute z-1 font-brand leading-none tracking-[0.03em] text-card uppercase [-webkit-text-stroke:1.5px_var(--line)] [paint-order:stroke_fill] [text-shadow:2px_2px_0_var(--line)]",
  sfxA: "-top-4 right-3.5 -rotate-8 text-[2.2rem] upto-520:text-[1.8rem]",
  sfxB: "-top-3.5 left-2 -rotate-12 text-[1.9rem] upto-520:text-[1.5rem]",
  sfxC: "-top-3.5 right-1.5 rotate-9 text-[1.9rem] upto-520:text-[1.5rem]",
  // narration box along the panel's bottom edge
  caption:
    "border-t-3 border-line bg-card px-[0.7rem] py-[0.45rem] font-letter text-[0.85rem] leading-[1.25] font-bold tracking-[0.02em] uppercase",
} as const;

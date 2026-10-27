// Tailwind classes for one manga's page (Details) and its buy strip
// (BuyStrip). Laptop: cover on the left, everything else on the right, sized
// to fit one screen. Phones (upto-720): a compact header with a small cover
// beside the title, then rating, notes and actions straight after.

// a small ink tag under the title (status, genre)
const tag = "rounded-[2px] border-[1.5px] px-[0.55rem] py-[0.12rem] text-[0.8rem] font-medium";

// the shape shared by the buy tickets and the "caught up" note
const ticket =
  "flex min-h-10 items-baseline gap-[0.45rem] rounded-ink border-[1.5px] px-3 py-[0.45rem] text-[0.92rem]";

export const detailsStyles = {
  backLink:
    "mb-8 inline-block text-[0.9rem] text-muted underline-offset-3 hover:text-ink hover:underline",

  layout:
    "grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1fr] items-start gap-x-[clamp(2rem,5vw,3.5rem)] gap-y-6 upto-720:grid-cols-[108px_minmax(0,1fr)] upto-720:gap-x-4 upto-720:gap-y-5",
  // the cover's height follows the viewport so the whole entry fits on a
  // laptop screen
  cover:
    "relative col-start-1 row-span-2 row-start-1 aspect-2/3 h-[clamp(260px,calc(100dvh-230px),390px)] upto-720:row-span-1 upto-720:h-auto upto-720:w-full [&_img]:size-full [&_img]:border-[1.5px] [&_img]:border-line [&_img]:bg-paper-2 [&_img]:object-cover [&_img]:shadow-[6px_6px_0_var(--hard-shadow)] upto-720:[&_img]:shadow-ink-lg",
  // the real cover leans a little; its loading skeleton doesn't
  coverTilt: "-rotate-[1.2deg] upto-720:rotate-0",
  // hanko-style "Done" stamp
  stamp:
    "absolute top-3.5 -right-3 rotate-12 rounded-[4px] border-[2.5px] border-accent bg-paper px-[0.6rem] py-[0.15rem] font-brand text-[1.35rem] tracking-[2px] text-accent upto-720:top-2 upto-720:-right-2 upto-720:border-2 upto-720:px-[0.4rem] upto-720:py-[0.05rem] upto-720:text-[0.95rem]",

  head: "col-start-2 row-start-1 flex min-w-0 flex-col gap-[0.7rem] upto-720:gap-2 upto-720:self-center",
  title:
    "text-[clamp(2.2rem,4.6vw,3.4rem)] leading-[1.02] font-medium tracking-[-0.025em] text-balance wrap-anywhere upto-720:text-[clamp(1.6rem,7vw,2.2rem)]",
  meta: "flex flex-wrap gap-[0.4rem]",
  metaGenre: `${tag} border-line-soft text-ink-soft`,
  metaReading: `${tag} border-accent text-accent`,
  metaDone: `${tag} border-ok text-ok`,
  progress:
    "font-display text-[1.4rem] leading-[1.3] text-ink-soft upto-720:text-[1.1rem]",
  // "chapter 140", underlined with a wash of spot colour
  chapter:
    "bg-[linear-gradient(to_top,var(--accent-wash)_0_40%,transparent_40%)] text-ink italic",
  // what they own, a quiet aside next to where they are in the story
  owned:
    "ml-[0.6rem] font-mono text-[0.8rem] whitespace-nowrap text-muted not-italic before:content-['·_']",

  body: "col-start-2 row-start-2 flex min-w-0 flex-col gap-5 upto-720:col-span-2 upto-720:col-start-1",
  label: "mb-[0.3rem] block font-mono text-[0.72rem] text-muted",
  rating: "border-t-[1.5px] border-line pt-4",
  // notes written on a ruled slip; the rule is drawn on the paragraph so
  // every line of text sits on one
  notes:
    "max-w-[62ch] border-[1.5px] border-line-soft bg-card px-4 pt-[0.7rem] pb-[0.6rem] [&_p]:bg-[repeating-linear-gradient(to_bottom,transparent_0_calc(1.6em-1px),var(--line-soft)_calc(1.6em-1px)_1.6em)] [&_p]:text-[1rem] [&_p]:leading-[1.6em] [&_p]:whitespace-pre-line [&_p]:wrap-anywhere",

  // where to buy: small price tickets in a row
  buy: "border-t-[1.5px] border-dashed border-line-soft pt-3",
  buyList: `flex flex-wrap gap-2 [&_a]:bg-card [&_a]:font-semibold [&_a]:transition-[background-color,border-color] [&_a]:duration-120 [&_a]:ease-[ease] [&_a]:hover:border-accent [&_a]:hover:bg-accent-wash [&_a]:focus-visible:border-accent [&_a]:focus-visible:bg-accent-wash`,
  // each link in buyList
  buyLink: `${ticket} border-line`,
  buyKind:
    "font-mono text-[0.68rem] font-normal tracking-[0.06em] text-muted uppercase",
  buyPrice: "font-mono font-medium text-accent",
  // "caught up": the same ticket shape, but nothing to click
  buyNote: `${ticket} border-dashed border-line-soft text-ink-soft`,
  buySkeleton: "h-[70px]",

  actions:
    "flex flex-wrap items-center gap-[0.85rem] upto-720:[&>.btn-primary]:flex-1 upto-720:[&>.btn-secondary]:flex-1",
  deleteBtn: "hover:enabled:text-accent",
  confirm: "inline-flex items-center gap-3 text-[0.9rem] text-ink-soft",
  confirmYes:
    "text-[0.9rem] font-semibold text-accent underline underline-offset-3",
  confirmNo: "text-[0.9rem] text-muted underline underline-offset-3",

  errorState:
    "mx-auto my-12 max-w-[440px] text-center [&_h1]:mb-2 [&_h1]:text-[2rem] [&_h1]:font-medium [&_p]:text-ink-soft",
  errorActions: "mt-7 flex items-center justify-center gap-4",
} as const;

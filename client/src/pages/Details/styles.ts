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
  // the chapter you're on, stepped right here. Inked like a panel, and big
  // enough for a thumb
  stepperWrap: "inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle",
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
  // what they own, a quiet aside next to where they are in the story
  owned:
    "mt-2 block font-mono text-[0.8rem] whitespace-nowrap text-muted not-italic",

  body: "col-start-2 row-start-2 flex min-w-0 flex-col gap-5 upto-720:col-span-2 upto-720:col-start-1",
  // with the release panel there's a third column on a laptop. Narrower, it
  // takes the row under the header and pushes the body down one
  layoutWithRelease:
    "min-[1001px]:grid-cols-[auto_minmax(0,1fr)_260px] min-[721px]:max-[1000px]:grid-rows-[auto_auto_1fr]",
  coverBesideRelease: "min-[721px]:max-[1000px]:row-span-3",
  bodyBelowRelease: "max-[1000px]:row-start-3",

  // the new release panel: a red headline slip with the dates under it
  release:
    "relative min-w-0 animate-card-in rounded-ink border-2 border-line bg-card shadow-ink-lg motion-reduce:animate-none min-[1001px]:col-start-3 min-[1001px]:row-span-2 min-[1001px]:row-start-1 min-[721px]:max-[1000px]:col-start-2 min-[721px]:max-[1000px]:row-start-2 upto-720:col-span-2 upto-720:col-start-1 upto-720:row-start-2",
  // the hanko-style stamp knocked onto the panel's top edge, kin to "Done"
  releaseStamp:
    "pointer-events-none absolute -top-4.5 right-2.5 z-1 rotate-6 rounded-[4px] border-[2.5px] border-accent bg-paper px-[0.5rem] py-[0.1rem] font-brand text-[1.15rem] tracking-[2px] text-accent max-[1000px]:-top-2.5 max-[1000px]:right-9 max-[1000px]:border-2 max-[1000px]:px-[0.35rem] max-[1000px]:py-0 max-[1000px]:text-[0.9rem] max-[1000px]:tracking-[1.5px]",
  releaseHit:
    "bg-accent bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] bg-size-[5px_5px] px-3.5 pt-6 pb-2.5 text-on-accent max-[1000px]:hidden",
  releaseHeadline:
    "origin-left -rotate-[1.5deg] font-brand text-[2.05rem] leading-none font-normal tracking-[1.5px] wrap-anywhere",
  releaseOwned: "mt-1.5 font-letter text-[0.95rem] font-bold",
  // the folded version: a full-width bar, tall enough for a thumb
  releaseBar:
    "hidden min-h-11 w-full cursor-pointer items-center gap-2 bg-accent px-3 py-2 text-left text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-[1000px]:flex [&_svg]:ml-auto [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-ink aria-expanded:[&_svg]:rotate-180",
  releaseBarPlain:
    "hidden min-h-11 items-center gap-2 bg-accent px-3 py-2 text-on-accent max-[1000px]:flex",
  releaseBarHeadline:
    "font-brand text-[1.3rem] leading-none tracking-[1px] whitespace-nowrap",
  releaseBarOwned: "font-letter text-[0.8rem] leading-tight font-bold",
  releaseBody: "px-3.5 pt-2 pb-3",
  releaseBodyShut: "max-[1000px]:hidden",
  // "Out now", "Coming up"
  releaseGroup: "not-first:mt-3 not-first:border-t not-first:border-dashed not-first:border-line-soft not-first:pt-3",
  releaseGroupTitle: "mb-1 font-mono text-[0.72rem] font-normal text-muted",
  releaseRow: "flex items-baseline justify-between gap-3 py-0.5",
  releaseWhat: "font-semibold whitespace-nowrap",
  releaseWhen: "text-right text-[0.92rem] text-ink-soft",
  releaseEstimate: "ml-1 font-mono text-[0.68rem] text-muted",
  label: "mb-[0.3rem] block font-mono text-[0.72rem] text-muted",
  rating: "border-t-[1.5px] border-line pt-4",
  // notes written on a ruled slip; the rule is drawn on the paragraph so
  // every line of text sits on one
  notes:
    "max-w-[62ch] border-[1.5px] border-line-soft bg-card px-4 pt-[0.7rem] pb-[0.6rem] [&_p]:bg-[repeating-linear-gradient(to_bottom,transparent_0_calc(1.6em-1px),var(--line-soft)_calc(1.6em-1px)_1.6em)] [&_p]:text-[1rem] [&_p]:leading-[1.6em] [&_p]:whitespace-pre-line [&_p]:wrap-anywhere",

  // where to buy: small price tickets in a row
  buy: "border-t-[1.5px] border-dashed border-line-soft pt-3",
  buyList: "flex flex-wrap gap-2",
  buyLink: `${ticket} border-line bg-card font-semibold transition-[background-color,border-color] duration-120 ease-[ease] hover:border-accent hover:bg-accent-wash focus-visible:border-accent focus-visible:bg-accent-wash`,
  // the heading with the series link across from it: a plain link, with room
  // around it for a thumb
  buyHead: "mb-1 flex items-baseline justify-between gap-3 [&_h2]:mb-0",
  buySeries:
    "-my-1.5 py-1.5 text-[0.85rem] font-medium whitespace-nowrap text-ink-soft underline decoration-line-soft underline-offset-3 transition-colors duration-120 ease-[ease] hover:text-accent hover:decoration-accent",
  buyKind:
    "font-mono text-[0.68rem] font-normal tracking-[0.06em] text-muted uppercase",
  buyPrice: "font-mono font-medium text-accent",
  // "caught up": the same ticket shape, but nothing to click
  buyNote: `${ticket} border-dashed border-line-soft text-ink-soft`,
  buySkeleton: "h-[70px]",

  actions:
    "flex flex-wrap items-center gap-[0.85rem] upto-720:[&>.btn-primary]:flex-1 upto-720:[&>.btn-secondary]:flex-1",
  // apart from the everyday actions, so a thumb can't catch it by accident
  deleteBtn: "ml-auto hover:enabled:text-accent upto-720:ml-0",
  confirm:
    "ml-auto inline-flex flex-wrap items-center gap-x-4 text-[0.9rem] text-ink-soft upto-720:ml-0",
  confirmYes:
    "min-h-11 text-[0.9rem] font-semibold text-accent underline underline-offset-3",
  confirmNo: "min-h-11 text-[0.9rem] text-ink-soft underline underline-offset-3",

  errorState:
    "mx-auto my-12 max-w-[440px] text-center [&_h1]:mb-2 [&_h1]:text-[2rem] [&_h1]:font-medium [&_p]:text-ink-soft",
  errorActions: "mt-7 flex items-center justify-center gap-4",
} as const;

// Tailwind classes for the Updates page: one big inked panel for the headline
// update, then plain groups to read through. Phones (upto-760) stack everything.

export const updatesStyles = {
  page: "mx-auto flex max-w-[900px] flex-col gap-[clamp(2.5rem,6vw,3.5rem)]",

  head: "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 upto-760:grid-cols-[minmax(0,1fr)_84px] upto-760:gap-3",
  title:
    "font-brand text-[clamp(2.8rem,7vw,4.4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  lead: "mt-3 max-w-[52ch] text-[1.08rem] leading-[1.55] text-ink-soft",
  kenji: "w-[120px] upto-760:w-[84px]",

  // the headline update: a shelf card as it really looks, beside what it means
  panel:
    "printed grid animate-panel-open grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] border-3 border-line bg-paper text-ink motion-reduce:animate-none upto-760:grid-cols-[minmax(0,1fr)]",
  panelArt:
    "relative grid min-h-[210px] content-center gap-1 border-r-3 border-line bg-[radial-gradient(var(--dots-strong)_1.3px,transparent_1.6px)] bg-size-[7px_7px] p-6 upto-760:min-h-0 upto-760:border-r-0 upto-760:border-b-3 upto-760:pt-8",
  sfx: "absolute top-2 left-3 -rotate-6 font-brand text-[1.5rem] leading-none tracking-[0.03em] text-accent uppercase [-webkit-text-stroke:1.2px_var(--line)] [paint-order:stroke_fill]",
  sample: "w-fit bg-paper px-3 py-2",
  sampleRelease: "font-brand text-[1.7rem] leading-[1.1] tracking-[1px] text-accent",
  sampleYours: "text-[0.9rem] text-ink-soft",
  panelCopy:
    "flex flex-col items-start justify-center gap-2 p-[clamp(1.25rem,3vw,2rem)] [&_p]:leading-[1.5] [&_p]:text-ink-soft",
  panelTitle:
    "font-brand text-[clamp(1.7rem,4vw,2.2rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",

  // a group: its name in the left column, the updates down the right
  group:
    "grid grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] gap-x-8 border-t-[1.5px] border-line pt-5 upto-760:grid-cols-[minmax(0,1fr)] upto-760:gap-y-2",
  groupTitle:
    "font-brand text-[1.55rem] leading-[1.1] font-normal tracking-[0.02em] uppercase",
  items:
    "flex flex-col [&>li]:border-b [&>li]:border-dashed [&>li]:border-line-soft [&>li]:py-3 [&>li:first-child]:pt-0 [&>li:last-child]:border-b-0 [&>li:last-child]:pb-0",
  itemName: "font-display text-[1.15rem] leading-[1.25] font-medium",
  itemBody: "mt-0.5 max-w-[62ch] leading-[1.5] text-ink-soft",
} as const;

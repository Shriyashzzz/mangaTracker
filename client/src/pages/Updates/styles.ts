// Tailwind classes for the What's new page: one big inked panel, a short list
// and what's coming. Phones (upto-760) stack everything.

export const updatesStyles = {
  page: "mx-auto flex max-w-[900px] flex-col gap-[clamp(2rem,5vw,3rem)]",

  head: "flex items-end justify-between gap-4",
  title:
    "font-brand text-[clamp(2.8rem,7vw,4.4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  // ink on paper in every theme, as on the About page; the dark theme would
  // otherwise turn his face black
  kenji:
    "printed block aspect-square w-[110px] shrink-0 overflow-hidden rounded-full border-[2.5px] border-line bg-card px-2.5 pt-2.5 upto-760:w-[76px] upto-760:px-1.5 upto-760:pt-1.5",

  // the headline update: a shelf card as it really looks, beside what it means
  panel:
    "printed grid animate-panel-open grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] border-3 border-line bg-paper text-ink motion-reduce:animate-none upto-760:grid-cols-[minmax(0,1fr)]",
  panelArt:
    "relative grid min-h-[190px] content-center justify-items-center border-r-3 border-line bg-[radial-gradient(var(--dots-strong)_1.3px,transparent_1.6px)] bg-size-[7px_7px] p-6 upto-760:min-h-0 upto-760:border-r-0 upto-760:border-b-3 upto-760:pt-9",
  sfx: "absolute top-2 left-3 -rotate-6 font-brand text-[1.5rem] leading-none tracking-[0.03em] text-accent uppercase [-webkit-text-stroke:1.2px_var(--line)] [paint-order:stroke_fill]",
  sample: "bg-paper px-3 py-2",
  sampleRelease: "font-brand text-[1.7rem] leading-[1.1] tracking-[1px] text-accent",
  sampleYours: "text-[0.9rem] text-ink-soft",
  panelCopy:
    "flex flex-col items-start justify-center gap-2 p-[clamp(1.25rem,3vw,2rem)] [&_p]:text-[1.05rem] [&_p]:leading-[1.45] [&_p]:text-ink-soft",
  panelTitle:
    "font-brand text-[clamp(1.7rem,4vw,2.2rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",

  // the rest, one under the other, each hung from a small inked diamond
  items: "flex flex-col border-b-[1.5px] border-line",
  item: "relative border-t-[1.5px] border-line py-4 pl-8 before:absolute before:top-[1.4rem] before:left-1 before:size-3 before:rotate-45 before:border-[1.5px] before:border-line before:bg-accent",
  itemName:
    "font-brand text-[1.45rem] leading-[1.1] font-normal tracking-[0.02em] uppercase",
  itemBody: "mt-1 leading-[1.45] text-ink-soft",

  // not out yet, so it looks unfinished: dashed, like a next-volume teaser
  soon: "relative border-[2.5px] border-dashed border-line bg-card px-[clamp(1.25rem,3vw,1.75rem)] py-5",
  soonSfx:
    "absolute -top-[1.05rem] right-5 rotate-6 font-brand text-[1.6rem] leading-none tracking-[0.03em] text-accent uppercase [-webkit-text-stroke:1.2px_var(--line)] [paint-order:stroke_fill]",
  soonTitle:
    "font-brand text-[1.45rem] leading-[1.1] font-normal tracking-[0.02em] uppercase",
} as const;

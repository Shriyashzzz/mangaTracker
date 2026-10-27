// Tailwind classes for the About page, which reads like a short manga: an
// opening panel, a three-panel strip and a next-volume teaser. Phones
// (upto-760) stack everything and turn the strip's panels side-on.

export const aboutStyles = {
  page: "mx-auto flex max-w-[980px] flex-col gap-[clamp(3rem,7vw,4.5rem)]",

  // ---------- opening panel, focus lines behind the character ----------
  hero: "grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-[clamp(1.5rem,5vw,3.5rem)] border-3 border-line bg-card bg-[radial-gradient(circle_at_22%_55%,var(--card)_0_18%,transparent_46%),repeating-conic-gradient(from_0deg_at_22%_55%,var(--line-soft)_0deg_0.8deg,transparent_0.8deg_7deg)] p-[clamp(1.25rem,3vw,2rem)] upto-760:grid-cols-[minmax(0,1fr)] upto-760:bg-[radial-gradient(circle_at_50%_22%,var(--card)_0_16%,transparent_40%),repeating-conic-gradient(from_0deg_at_50%_22%,var(--line-soft)_0deg_0.8deg,transparent_0.8deg_7deg)]",
  heroArt: "relative max-w-[260px] justify-self-center pt-10 upto-760:max-w-[170px]",
  heroBubble:
    "absolute -top-2 left-[52%] w-max max-w-52 rounded-[50%] border-[2.5px] border-line bg-paper px-[0.9rem] py-[0.55rem] text-center font-letter text-[0.85rem] leading-[1.25] font-bold uppercase upto-760:left-[60%] upto-760:max-w-40 upto-760:text-[0.78rem]",
  heroCopy: "flex flex-col gap-4",
  title:
    "font-brand text-[clamp(2.3rem,5.4vw,3.8rem)] leading-[0.98] font-normal tracking-[0.01em] text-balance uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  lead: "max-w-136 text-[1.08rem] leading-[1.65] font-medium text-line [&_a]:border-b-2 [&_a]:border-b-[orange] [&_a]:text-inherit [&_a]:no-underline [&_a]:transition-[opacity,border-color] [&_a]:duration-200 [&_a]:ease-[ease] [&_a]:hover:border-b-line [&_a]:hover:opacity-80",

  // ---------- three-panel strip ----------
  sectionTitle:
    "mb-[1.1rem] font-brand text-[clamp(1.8rem,4vw,2.4rem)] font-normal tracking-[0.02em] uppercase",
  strip:
    "grid grid-cols-3 gap-3 border-[1.5px] border-line-soft bg-card p-3 upto-760:grid-cols-[minmax(0,1fr)] upto-760:gap-[9px] upto-760:p-[9px]",
  // phones: caption across the top, character left, words right
  panel:
    "flex flex-col border-3 border-line bg-paper upto-760:grid upto-760:grid-cols-[110px_minmax(0,1fr)] upto-760:items-center",
  caption:
    "border-b-3 border-line bg-card px-3 py-[0.45rem] font-letter text-[0.82rem] font-bold tracking-[0.02em] uppercase upto-760:col-span-2",
  // the middle (panic) panel gets screentone, like the shading for a bad moment
  panelArt:
    "grid flex-1 place-items-center px-6 pt-5 pb-2 upto-760:p-3 [&_svg]:max-w-[150px] [li:nth-child(2)>&]:bg-[radial-gradient(var(--dots-strong)_1.2px,transparent_1.5px)] [li:nth-child(2)>&]:bg-size-[7px_7px]",
  bubble:
    "bubble-tail-mascot relative mx-[0.9rem] mt-[0.9rem] mb-4 rounded-[50%] border-[2.5px] border-line bg-card px-[0.9rem] py-[0.6rem] text-center font-letter text-[0.85rem] leading-[1.3] font-bold uppercase upto-760:my-3 upto-760:mr-3 upto-760:ml-0",

  // ---------- teaser + call to action, like the back pages of a volume ----------
  backMatter:
    "grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center justify-center gap-[clamp(2rem,5vw,3.5rem)] upto-760:grid-cols-[minmax(0,1fr)] upto-760:gap-12",
  next: "relative border-3 border-dashed border-line bg-card px-7 py-6 [&_p]:text-ink-soft",
  nextSfx:
    "absolute -top-[1.2rem] right-5 rotate-6 font-brand text-[1.9rem] tracking-[0.03em] text-accent uppercase [-webkit-text-stroke:1.5px_var(--line)] [paint-order:stroke_fill]",
  nextTitle: "mb-[0.4rem] font-display text-[1.6rem] font-medium",
  cta: "flex w-fit",
} as const;

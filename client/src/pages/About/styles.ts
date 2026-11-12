// Tailwind classes for the About page, which reads like a short manga: an
// opening panel, a four-panel strip, and a panel for each half of the site.
// Phones (upto-760) stack everything and turn the strip's panels side-on.

export const aboutStyles = {
  page: "mx-auto flex max-w-[980px] flex-col gap-[clamp(3rem,7vw,4.5rem)]",

  // ---------- opening panel, focus lines behind the character ----------
  hero: "grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-[clamp(1.5rem,5vw,3.5rem)] border-3 border-line bg-card bg-[linear-gradient(to_right,transparent_30%,var(--card)_44%),radial-gradient(circle_at_22%_55%,var(--card)_0_18%,transparent_46%),repeating-conic-gradient(from_0deg_at_22%_55%,var(--line-soft)_0deg_0.8deg,transparent_0.8deg_7deg)] p-[clamp(1.25rem,3vw,2rem)] upto-760:grid-cols-[minmax(0,1fr)] upto-760:bg-[linear-gradient(to_bottom,transparent_26%,var(--card)_36%),radial-gradient(circle_at_50%_22%,var(--card)_0_16%,transparent_40%),repeating-conic-gradient(from_0deg_at_50%_22%,var(--line-soft)_0deg_0.8deg,transparent_0.8deg_7deg)]",
  heroArt:
    "relative max-w-[260px] justify-self-center pt-10 upto-760:max-w-[170px]",
  heroMascot:
    "block aspect-square rounded-full border-[2.5px] border-line bg-card px-4 pt-4 pb-1",
  heroBubble:
    "absolute -top-2 left-[52%] w-max max-w-52 rounded-[50%] border-[2.5px] border-line bg-paper px-[0.9rem] py-[0.55rem] text-center font-letter text-[0.85rem] leading-[1.25] font-bold uppercase upto-860:left-[38%] upto-860:max-w-40 upto-860:text-[0.78rem] upto-760:left-[60%]",
  heroCopy: "flex flex-col gap-4",
  title:
    "font-brand text-[clamp(2.3rem,5.4vw,3.8rem)] leading-[0.98] font-normal tracking-[0.01em] text-balance uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  lead: "max-w-136 text-[1.08rem] leading-[1.65] font-medium text-line [&_a]:border-b-2 [&_a]:border-b-[orange] [&_a]:text-inherit [&_a]:no-underline [&_a]:transition-[opacity,border-color] [&_a]:duration-200 [&_a]:ease-[ease] [&_a]:hover:border-b-line [&_a]:hover:opacity-80",

  // ---------- four-panel strip ----------
  sectionTitle:
    "mb-[1.1rem] font-brand text-[clamp(1.8rem,4vw,2.4rem)] font-normal tracking-[0.02em] uppercase",
  strip:
    "grid grid-cols-4 gap-3 upto-860:grid-cols-2 border-[1.5px] border-line-soft bg-card p-3 upto-760:grid-cols-[minmax(0,1fr)] upto-760:gap-[9px] upto-760:p-[9px]",
  // phones: caption across the top, character left, words right
  panel:
    "flex flex-col border-3 border-line bg-paper upto-760:grid upto-760:grid-cols-[110px_minmax(0,1fr)] upto-760:items-center",
  caption:
    "border-b-3 border-line bg-card px-3 py-[0.45rem] font-letter text-[0.82rem] font-bold tracking-[0.02em] uppercase upto-760:col-span-2",
  // the middle (panic) panel gets screentone, like the shading for a bad moment
  panelArt:
    "grid flex-1 place-items-center px-5 pt-5 pb-2 upto-760:p-3 [&_svg]:max-w-[130px] [li:nth-child(2)>&]:bg-[radial-gradient(var(--dots-strong)_1.2px,transparent_1.5px)] [li:nth-child(2)>&]:bg-size-[7px_7px]",
  bubble:
    "bubble-tail-mascot relative mx-[0.9rem] mt-[0.9rem] mb-4 rounded-[50%] border-[2.5px] border-line bg-card px-[0.9rem] py-[0.6rem] text-center font-letter text-[0.85rem] leading-[1.3] font-bold uppercase upto-760:my-3 upto-760:mr-3 upto-760:ml-0",

  // ---------- what it can do: a panel for each half of the site ----------
  does: "grid grid-cols-2 gap-3 border-[1.5px] border-line-soft bg-card p-3 upto-560:grid-cols-[minmax(0,1fr)] upto-560:gap-[9px] upto-560:p-[9px]",
  doesPanel: "flex flex-col border-3 border-line bg-paper",
  doesArt:
    "relative grid min-h-[150px] place-items-center border-b-3 border-line upto-560:min-h-[120px]",
  // focus lines for the shelf, screentone for the price
  doesLines:
    "bg-[radial-gradient(circle_at_50%_50%,var(--paper)_0_26%,transparent_62%),repeating-conic-gradient(from_0deg_at_50%_50%,var(--line)_0deg_0.7deg,transparent_0.7deg_6deg)]",
  doesTone:
    "bg-[radial-gradient(var(--dots-strong)_1.3px,transparent_1.6px)] bg-size-[7px_7px]",
  doesBig:
    "bg-paper px-[0.25em] py-[0.05em] font-brand text-[clamp(3.4rem,7vw,4.6rem)] leading-none tracking-[0.02em] text-ink [&_small]:mr-[0.1em] [&_small]:text-[0.45em] [&_small]:text-muted",
  doesSfx:
    "absolute top-2 left-3 -rotate-6 font-brand text-[1.8rem] leading-none tracking-[0.03em] text-card uppercase [-webkit-text-stroke:1.5px_var(--line)] [paint-order:stroke_fill] [text-shadow:2px_2px_0_var(--line)]",
  doesCopy:
    "flex flex-1 flex-col items-start gap-1 p-4 [&_p]:flex-1 [&_p]:leading-[1.5] [&_p]:text-ink-soft",
  doesTitle:
    "font-brand text-[1.6rem] leading-[1.05] font-normal tracking-[0.03em] uppercase",
  doesLink:
    "tap mt-1 py-1 font-medium text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line",

  cta: "flex flex-wrap justify-center gap-3",

  // ---------- getting in touch, and the credits ----------
  contact:
    "flex flex-col items-center gap-2 border-t-[1.5px] border-line pt-[clamp(2rem,5vw,3rem)] text-center",
  contactTitle:
    "font-brand text-[clamp(1.8rem,4vw,2.4rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",
  contactBody: "max-w-[34rem] leading-[1.5] text-ink-soft",
  contactButtons: "mt-2 flex flex-wrap justify-center gap-3",
  contactAddress: "font-mono text-[0.85rem] break-all text-ink-soft",
  credits:
    "tap mt-3 py-1 font-medium text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line",
} as const;

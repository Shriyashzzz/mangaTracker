// Tailwind classes for the tour. The panels are the About page's, so the two read
// as one comic; only the opening and his portrait are its own.
export const guideStyles = {
  page: "mx-auto flex max-w-[980px] flex-col gap-[clamp(1.75rem,4vw,2.5rem)]",
  head: "flex items-end justify-between gap-4",
  title:
    "font-brand text-[clamp(2.8rem,7vw,4.4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  lead: "mt-3 max-w-[34rem] text-[1.05rem] leading-[1.5] text-ink-soft",
  kenji:
    "block aspect-square w-[110px] shrink-0 overflow-hidden rounded-full border-[2.5px] border-line bg-card px-2.5 pt-2.5 upto-760:w-[76px] upto-760:px-1.5 upto-760:pt-1.5",
  panelKenji: "block w-[92px] bg-paper px-1 pt-1",
} as const;

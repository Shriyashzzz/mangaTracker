// The "Sales right now" strip (DealsStrip.tsx): a slip on the price pages,
// following the theme, in the price list's ink and dashed rules (pages/Prices/styles.ts)
export const dealsStyles = {
  strip: "mb-5 border-[1.5px] border-line bg-card px-4 pt-2.5 pb-3 shadow-ink",
  head: "flex items-center justify-between gap-3",
  title:
    "font-brand text-[1.15rem] leading-none font-normal tracking-[0.03em] uppercase",
  close:
    "tap -mr-2 grid size-9 place-items-center text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:outline-dashed",
  list: "mt-1 flex flex-col",
  deal: "flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-dashed border-line-soft py-1.5 first:border-t-0",
  // on a phone the code and end date go under the sale, not beside it
  link: "tap min-w-0 flex-1 upto-520:basis-full text-[0.92rem] text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-dashed",
  store: "font-semibold text-ink",
  // a coupon code, copied on a tap: set like a stamp label
  code: "tap border border-dashed border-line px-1.5 font-mono text-[0.8rem] tracking-[0.04em] uppercase hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:outline-dashed",
  ends: "font-mono text-[0.75rem] text-muted",
} as const;

// Classes for the review section of a volume's page (VolumeReviews and its
// parts). The same ink-and-paper pieces as the rest of the price pages.
const softLink =
  "tap text-[0.84rem] text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current disabled:opacity-60";
const smallCaps =
  "font-mono text-[0.72rem] font-medium tracking-[0.08em] text-muted uppercase";
const dashedBox =
  "border-[1.5px] border-dashed border-line bg-paper px-4 py-[0.9rem]";

export const reviewStyles = {
  section: "mt-10 border-t-[1.5px] border-dashed border-line-soft pt-6",
  head: "mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 [&_h2]:mb-0",

  // the score beside the reviews; stacked on a phone
  box: "grid grid-cols-[13.5rem_minmax(0,1fr)] border-2 border-line bg-card shadow-ink-lg upto-720:grid-cols-1",
  score:
    "border-r-[1.5px] border-dashed border-line p-5 upto-720:grid upto-720:grid-cols-[auto_minmax(0,1fr)] upto-720:items-center upto-720:gap-x-5 upto-720:border-r-0 upto-720:border-b-[1.5px] upto-720:p-4",
  scoreNumber:
    "font-display text-[3.4rem] leading-none font-semibold tracking-[-0.02em] [&_small]:ml-1 [&_small]:font-mono [&_small]:text-[1rem] [&_small]:font-normal [&_small]:tracking-normal [&_small]:text-muted",
  scoreWho: "mt-[0.4rem] text-[0.84rem] text-muted",
  bars: "mt-4 grid gap-[5px] upto-720:mt-0",
  bar: "grid grid-cols-[0.9rem_minmax(0,1fr)_1.4rem] items-center gap-2 font-mono text-[0.74rem] text-muted tabular-nums",
  barTrack: "block h-[9px] border-[1.5px] border-line bg-paper",
  barFill: "block h-full bg-ink",

  list: "min-w-0 px-5 pb-3 upto-720:px-4",
  item: "border-b-[1.5px] border-dashed border-line-soft py-4 last:border-b-0",
  itemTop: "flex flex-wrap items-center justify-between gap-x-4 gap-y-1",
  who: "flex min-w-0 items-center gap-2 text-[0.88rem] text-ink-soft [&_b]:font-semibold [&_b]:text-ink",
  face: "size-7 shrink-0 border-[1.5px]",
  when: "font-mono text-[0.8rem] text-muted",
  text: "mt-[0.4rem] max-w-[62ch] whitespace-pre-line [overflow-wrap:anywhere]",
  acts: "mt-2 flex flex-wrap items-center gap-x-4 gap-y-1",
  link: softLink,
  said: "text-[0.84rem] text-muted",
  more: `${softLink} mt-2 inline-block`,

  // a spoiler: inked out like a censor bar, one tap to read
  spoiler:
    "tap relative mt-[0.4rem] grid w-full max-w-[62ch] gap-[6px] text-left focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent focus-visible:outline-dashed [&_i]:block [&_i]:h-[14px] [&_i]:rounded-[2px] [&_i]:bg-ink [&_i:nth-child(2)]:w-[92%] [&_i:nth-child(3)]:w-[58%]",
  spoilerLabel:
    "absolute inset-0 grid place-items-center [&_b]:border-[1.5px] [&_b]:border-line [&_b]:bg-paper [&_b]:px-[0.6rem] [&_b]:pt-[0.3rem] [&_b]:pb-[0.22rem] [&_b]:font-mono [&_b]:text-[0.74rem] [&_b]:font-medium [&_b]:tracking-[0.08em] [&_b]:text-ink [&_b]:uppercase [&_b]:shadow-[2px_2px_0_var(--hard-shadow)]",

  // the viewer's own review, and what stands in for the form
  yours: `${dashedBox} mb-4 bg-card`,
  chip: "border-[1.5px] border-line bg-paper px-[0.4rem] pt-[0.22rem] pb-[0.16rem] font-mono text-[0.7rem] font-medium tracking-[0.06em] uppercase",
  nudge: `${dashedBox} mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 [&_b]:font-semibold`,
  empty: `${dashedBox} [&_b]:font-semibold`,
  emptyNote: "mt-1 mb-3 text-[0.84rem] text-muted",

  // the write box
  form: "mb-4 max-w-[35rem] border-2 border-line bg-card p-4 shadow-ink-lg",
  label: `${smallCaps} mb-1 block`,
  words:
    "block min-h-[5.75rem] w-full resize-y rounded-[2px] border-[1.5px] border-line bg-paper px-3 py-[0.6rem] text-[1rem] leading-[1.45] text-ink placeholder:text-muted focus:bg-card focus:shadow-[3px_3px_0_var(--accent)] focus:outline-none",
  under: "mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
  tick: "tap flex min-h-11 cursor-pointer items-center gap-2 text-[0.92rem] [&_input]:size-5 [&_input]:accent-accent",
  count: "font-mono text-[0.8rem] text-muted tabular-nums",
  countOver: "font-mono text-[0.8rem] font-medium text-accent-ink tabular-nums",
  shownAs: "text-[0.84rem] text-muted [&_b]:font-semibold [&_b]:text-ink",
  buttons: "flex flex-wrap items-center gap-3",
  problem: "mt-2 text-[0.88rem] font-medium text-accent-ink",
};

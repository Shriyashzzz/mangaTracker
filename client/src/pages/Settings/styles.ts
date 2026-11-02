// Tailwind classes shared by the settings and profile pages.

const row = "flex min-h-11 cursor-pointer items-center gap-3 [&_input]:size-[18px] [&_input]:shrink-0 [&_input]:accent-[var(--accent)]";

export const settingsStyles = {
  page: "mx-auto flex max-w-[960px] flex-col gap-[clamp(1.25rem,3vw,2rem)]",
  // tabs down the left on laptops, across the top on phones
  layout:
    "grid grid-cols-[11rem_minmax(0,1fr)] items-start gap-[clamp(1.5rem,4vw,3rem)] upto-760:grid-cols-[minmax(0,1fr)] upto-760:gap-5",
  tabs: "sticky top-4 flex flex-col gap-1 upto-760:static upto-760:grid upto-760:grid-cols-3 upto-760:gap-2",
  tab: "tap flex min-h-11 items-center rounded-ink border-2 border-transparent px-3 font-medium text-ink-soft transition-colors duration-120 ease-[ease] hover:text-ink upto-760:min-h-9 upto-760:justify-center upto-760:border-[1.5px] upto-760:border-line-soft upto-760:px-1 upto-760:text-center upto-760:text-[0.85rem]",
  tabActive:
    "tap flex min-h-11 items-center rounded-ink border-2 border-line bg-card px-3 font-semibold text-ink upto-760:min-h-9 upto-760:justify-center upto-760:border-[1.5px] upto-760:px-1 upto-760:text-center upto-760:text-[0.85rem]",
  panel: "min-w-0",
  tabBody: "flex flex-col gap-5",
  tabTitle:
    "font-brand text-[clamp(1.9rem,4.5vw,2.6rem)] leading-[1] font-normal tracking-[0.02em] uppercase",
  title:
    "font-brand text-[clamp(2.6rem,6vw,3.8rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  section: "flex flex-col gap-3 border-t-[1.5px] border-line pt-5",
  heading:
    "font-brand text-[clamp(1.5rem,4vw,1.9rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",
  body: "max-w-[60ch] leading-[1.5] text-ink-soft",
  group: "flex flex-col gap-1 border-0 p-0",
  legend: "mb-1 font-semibold",
  row,
  field: "flex flex-col gap-1.5 [&_label]:font-semibold",
  input:
    "h-11 w-full max-w-[26rem] rounded-[2px] border-2 border-line bg-card px-3 text-[1rem] focus:border-accent focus:outline-none aria-invalid:border-accent",
  select:
    "h-11 w-full max-w-[26rem] cursor-pointer rounded-[2px] border-2 border-line bg-card px-2 text-[1rem] focus:border-accent focus:outline-none",
  actions: "flex flex-wrap items-center gap-x-4 gap-y-2",
  saved: "text-[0.9rem] font-medium text-ink-soft",
  failed: "text-[0.9rem] font-medium text-accent",
  link: "underline decoration-accent decoration-2 underline-offset-3",
  // the pictures
  // 36 of them, so every row comes out full
  pictures: "grid grid-cols-6 gap-2 upto-760:grid-cols-4 upto-520:grid-cols-3",
  picture:
    "flex cursor-pointer flex-col items-center gap-1.5 rounded-ink border-2 border-transparent p-2 text-center text-[0.85rem] leading-[1.2] has-checked:border-accent has-checked:bg-accent-wash has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent [&_input]:sr-only",
  pictureArt: "w-full max-w-24",
  headArt: "w-20 shrink-0 upto-520:w-16",
  head: "flex items-center gap-4",
  // sharing
  shareLink:
    "flex flex-wrap items-center gap-3 rounded-ink bg-accent-wash px-3 py-2",
  shareUrl: "w-full font-mono text-[0.9rem] break-all",
  danger: "text-accent",
} as const;

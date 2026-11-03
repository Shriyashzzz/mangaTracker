// Tailwind classes for the MyAnimeList import page: two steps on one inked
// sheet, then what's in the file, then how it went.

export const importStyles = {
  page: "mx-auto flex max-w-[640px] flex-col gap-6",
  back: "tap inline-block text-[0.9rem] text-muted underline-offset-3 hover:text-ink hover:underline",
  title:
    "mt-2 font-brand text-[clamp(2.3rem,6.5vw,3.4rem)] leading-[0.98] font-normal tracking-[0.01em] text-balance uppercase",

  sheet:
    "flex flex-col gap-6 border-3 border-line bg-card p-[clamp(1.25rem,4vw,2rem)]",
  step: "grid grid-cols-[2.2rem_minmax(0,1fr)] gap-x-3",
  stepNumber:
    "grid size-9 -rotate-3 place-items-center bg-ink font-brand text-[1.3rem] leading-none text-paper",
  stepTitle: "font-display text-[1.2rem] leading-[1.25] font-medium",
  stepBody: "mt-1 leading-[1.5] text-ink-soft",
  stepLink:
    "tap mt-1 inline-block font-medium text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line",

  // the whole box is the file button, and files can be dropped on it
  drop: "relative mt-3 grid min-h-32 cursor-pointer place-items-center border-[2.5px] border-dashed border-line-soft bg-paper px-4 py-6 text-center transition-colors duration-120 ease-[ease] hover:border-line focus-within:border-accent has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-accent has-[input:focus-visible]:outline-dashed",
  dropActive: "border-accent bg-accent-wash",
  dropInput: "absolute inset-0 size-full cursor-pointer opacity-0",
  dropTitle: "font-brand text-[1.3rem] tracking-[0.02em] uppercase",
  dropHint: "mt-0.5 text-[0.88rem] text-ink-soft",

  error: "mt-3 font-medium text-accent",

  found:
    "font-brand text-[clamp(1.6rem,4.5vw,2.1rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",
  fileName: "mt-1 truncate font-mono text-[0.8rem] text-muted",
  lists: "mt-4 border-t-[1.5px] border-line-soft",
  list: "flex min-h-12 cursor-pointer items-center gap-3 border-b border-dashed border-line-soft has-[input:disabled]:cursor-default has-[input:disabled]:opacity-50",
  listCheck:
    "size-5 shrink-0 cursor-pointer accent-accent disabled:cursor-default",
  listName: "flex-1 font-medium",
  listCount: "font-mono text-[0.9rem] text-ink-soft tabular-nums",
  // which app the list comes from: two across on phones, three on bigger screens
  sources: "grid grid-cols-3 gap-2 upto-520:grid-cols-2",
  usernameRow: "mt-3 flex flex-wrap items-center gap-3",
  usernameInput:
    "min-h-11 min-w-0 flex-[1_1_14rem] border-[2.5px] border-line bg-paper px-3 text-[1rem] text-ink outline-none focus-visible:border-accent",
  source:
    "tap min-h-11 border-[2.5px] border-line bg-card px-2 py-2 text-[0.92rem] font-medium leading-tight transition-colors duration-150 hover:bg-accent-wash aria-pressed:bg-ink aria-pressed:text-paper",
  seriesList:
    "mt-4 max-h-[min(60vh,32rem)] overflow-y-auto border-t-[1.5px] border-line-soft",
  seriesText: "flex min-w-0 flex-1 flex-col py-1.5",
  seriesMeta: "text-[0.85rem] text-ink-soft",
  warning:
    "border-[1.5px] border-dashed border-accent bg-accent-wash px-3 py-2 text-[0.9rem] leading-[1.45]",
  note: "mt-3 text-[0.9rem] leading-[1.45] text-ink-soft",
  actions: "mt-5 flex flex-wrap items-center gap-3",

  progressLine: "font-medium",
  bar: "mt-2 h-2.5 overflow-hidden border-[1.5px] border-line bg-paper",
  barFill:
    "h-full bg-accent transition-[width] duration-300 ease-ink motion-reduce:transition-none",

  result: "flex flex-col items-center gap-2 text-center",
  resultTitle:
    "font-brand text-[clamp(1.9rem,5vw,2.5rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",
  resultBody: "max-w-[44ch] leading-[1.5] text-ink-soft",
} as const;

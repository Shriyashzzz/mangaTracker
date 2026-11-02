// Tailwind classes for the page that explains the New tab, and its controls.

const heading =
  "font-brand text-[clamp(1.6rem,4vw,2rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase";

export const newReleasesStyles = {
  page: "mx-auto flex max-w-[720px] flex-col gap-[clamp(2rem,5vw,3rem)]",
  head: "flex items-end justify-between gap-4",
  title:
    "font-brand text-[clamp(2.8rem,7vw,4.4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  // ink on paper in every theme; the dark theme would otherwise turn his face black
  kenji:
    "printed block aspect-square w-[110px] shrink-0 overflow-hidden rounded-full border-[2.5px] border-line bg-card px-2.5 pt-2.5 upto-760:w-[76px] upto-760:px-1.5 upto-760:pt-1.5",
  section: "flex flex-col gap-3 [&_p]:max-w-[65ch] [&_p]:leading-[1.55] [&_p]:text-ink-soft",
  heading,
  sources: "flex flex-col border-b-[1.5px] border-line",
  source:
    "grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-6 gap-y-1 border-t-[1.5px] border-line py-3 upto-520:grid-cols-[minmax(0,1fr)]",
  sourceName: "font-brand text-[1.2rem] leading-[1.15] font-normal tracking-[0.02em] uppercase",

  // the controls
  panel: "printed flex flex-col gap-6 border-3 border-line bg-paper p-[clamp(1.25rem,3vw,1.75rem)] text-ink",
  group: "flex flex-col gap-1 border-0 p-0",
  legend: "mb-1 font-brand text-[1.3rem] leading-[1.1] tracking-[0.02em] uppercase",
  groupNote: "mb-1 text-[0.9rem] text-ink-soft",
  option: "flex min-h-11 cursor-pointer items-center gap-3 [&_input]:size-[18px] [&_input]:shrink-0 [&_input]:accent-[var(--accent)]",
  sliderRow: "ml-[30px] flex items-center gap-3 pb-1",
  slider: "h-11 min-w-0 flex-1 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40",
  sliderValue: "w-8 shrink-0 text-right font-mono text-[1rem]",
  example: "mt-1 rounded-ink bg-accent-wash px-3 py-2 text-[0.92rem] text-ink",
  status: "min-h-6 text-[0.9rem] font-medium text-ink-soft",
  failed: "min-h-6 text-[0.9rem] font-medium text-accent",
} as const;

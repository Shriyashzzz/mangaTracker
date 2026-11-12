// Tailwind classes for the FAQ: a heading, then each group's questions as
// rows that open. Plain on purpose: someone is here for one answer.

export const faqStyles = {
  page: "mx-auto flex max-w-[760px] flex-col gap-[clamp(1.75rem,4vw,2.5rem)]",
  title:
    "font-brand text-[clamp(2.6rem,7vw,4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  hit: "inline-block -rotate-2 bg-accent px-[0.12em] text-on-accent",
  lead: "mt-3 max-w-[52ch] text-[1.05rem] leading-[1.5] text-ink-soft",
  groupName:
    "mb-1 inline-block bg-[linear-gradient(var(--accent),var(--accent))] bg-size-[1.8em_3px] bg-left-bottom bg-no-repeat pb-[0.2rem] font-brand text-[1.45rem] font-normal tracking-[0.03em] uppercase",
  list: "flex flex-col border-b-[1.5px] border-line",
  item: "group border-t-[1.5px] border-line",
  question:
    "tap flex min-h-12 cursor-pointer items-center justify-between gap-4 py-3 text-[1.05rem] font-semibold text-ink marker:content-none hover:text-accent [&::-webkit-details-marker]:hidden",
  // a plus that turns to a cross when its answer is open
  mark: "relative size-4 shrink-0 transition-transform duration-150 ease-[ease] group-open:rotate-45 before:absolute before:top-1/2 before:left-0 before:h-[2px] before:w-full before:-translate-y-1/2 before:bg-current after:absolute after:top-0 after:left-1/2 after:h-full after:w-[2px] after:-translate-x-1/2 after:bg-current motion-reduce:transition-none",
  answer: "max-w-[62ch] pb-4 leading-[1.6] text-ink-soft",
  more: "text-ink-soft [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-accent [&_a]:decoration-2 [&_a]:underline-offset-3",
} as const;

// Tailwind classes for the Acknowledgements page: a plain credits list, read
// like the colophon at the back of a volume.

export const acknowledgementsStyles = {
  page: "mx-auto flex max-w-[760px] flex-col gap-[clamp(2rem,5vw,3rem)]",

  title:
    "font-brand text-[clamp(2.4rem,7vw,4rem)] leading-[0.95] font-normal tracking-[0.01em] uppercase",
  lead: "mt-3 text-[1.05rem] leading-[1.5] text-ink-soft",

  sectionTitle:
    "mb-2 font-brand text-[clamp(1.5rem,4vw,1.9rem)] leading-[1.1] font-normal tracking-[0.02em] uppercase",
  items: "flex flex-col border-b-[1.5px] border-line",
  item: "border-t-[1.5px] border-line py-3",
  itemName:
    "font-medium text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line",
  itemBody: "mt-1 leading-[1.45] text-ink-soft",
  body: "leading-[1.5] text-ink-soft [&+&]:mt-2",
} as const;

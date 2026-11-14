// Classes for the site owner's list of reported reviews (ReportedReviews).
const chip =
  "border-[1.5px] px-[0.4rem] pt-[0.22rem] pb-[0.16rem] font-mono text-[0.7rem] font-medium tracking-[0.06em] uppercase";

export const reportedStyles = {
  page: "prices-page flex max-w-[45rem] flex-col gap-4",
  sub: "max-w-[60ch] text-[0.9rem] text-ink-soft",
  list: "flex flex-col gap-[0.9rem]",
  item: "border-[1.5px] border-line bg-card px-4 py-[0.9rem]",
  meta: "flex flex-wrap items-center gap-x-[0.9rem] gap-y-1 text-[0.86rem] text-ink-soft [&_b]:font-semibold [&_b]:text-ink",
  chip: `${chip} border-line bg-paper text-ink`,
  chipHot: `${chip} border-accent bg-accent text-on-accent`,
  when: "font-mono text-[0.8rem] text-muted",
  text: "mt-[0.4rem] max-w-[62ch] whitespace-pre-line [overflow-wrap:anywhere]",
  actions: "mt-3 flex flex-wrap items-center gap-3 upto-520:[&_.btn]:flex-1",
  link: "tap text-[0.84rem] text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink",
  problem: "mt-2 text-[0.88rem] font-medium text-accent-ink",
};

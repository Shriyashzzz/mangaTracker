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

  // the site's numbers, above the list: three across, two on a phone. Each
  // is drawn as the Volumes tab's totals are (volumesStyles.total*)
  numbers:
    "grid grid-cols-3 gap-px border-[1.5px] border-line bg-line upto-520:grid-cols-2",
  number: "flex flex-col gap-1 bg-card px-4 py-3",

  // the owner's tools: links in two columns, one on a phone, and the
  // scripts folded under them
  tools:
    "flex flex-col gap-3 border-[1.5px] border-line bg-card px-4 py-[0.9rem]",
  toolsTitle:
    "font-brand text-[1.35rem] leading-none tracking-[0.04em] uppercase",
  toolsGroups: "grid grid-cols-2 gap-x-6 gap-y-3 upto-520:grid-cols-1",
  toolsHead:
    "mb-1 cursor-default font-sans text-[0.78rem] font-semibold tracking-[0.06em] text-ink-soft uppercase",
  toolsList: "flex flex-col gap-1.5 text-[0.9rem]",
  toolLink:
    "tap font-medium underline decoration-line-soft underline-offset-3 hover:decoration-current",
  toolWhat: "text-[0.82rem] text-muted",
  scripts:
    "[&>summary]:cursor-pointer [&>summary]:underline-offset-3 [&>summary:hover]:underline",
  // a command on its own line, whole: smaller on a phone so it fits
  command:
    "block overflow-x-auto font-mono text-[0.8rem] whitespace-nowrap upto-520:text-[0.7rem]",
};

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

  // scroll-mt: Kenji's "Review and add" lands here (#import-found) with room
  found:
    "scroll-mt-6 font-brand text-[clamp(1.6rem,4.5vw,2.1rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",
  fileName: "mt-1 truncate font-mono text-[0.8rem] text-muted",
  // several files: how many, and their names on hover (laptops) or a tap
  files: "group/files relative mt-1 w-fit max-w-full",
  filesButton:
    "tap inline-flex min-h-8 items-center gap-1 font-mono text-[0.8rem] text-muted underline decoration-line-soft decoration-dashed underline-offset-3 hover:text-ink aria-expanded:text-ink",
  filesChevron:
    "size-3.5 shrink-0 transition-transform duration-150 group-aria-expanded/button:rotate-180",
  // below the button with no gap to cross, so moving onto the list keeps it open
  filesPop: "absolute top-full left-0 z-20 pt-1",
  filesPanel:
    "w-max max-w-[min(26rem,calc(100vw-4rem))] rounded-ink border-[2.5px] border-line bg-card px-3 py-2 shadow-[0_14px_30px_-14px_rgba(20,14,8,0.45)] animate-drop motion-reduce:animate-none",
  filesItem:
    "border-b border-dashed border-line-soft py-1.5 font-mono text-[0.8rem] leading-[1.35] text-ink-soft [overflow-wrap:anywhere] last:border-b-0",
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
  // Select all / Clear all, above the list's right edge
  listTools: "mt-3 flex justify-end",
  selectAll:
    "tap min-h-9 text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current disabled:cursor-default disabled:opacity-50 disabled:no-underline",
  seriesList:
    "mt-1 max-h-[min(60vh,32rem)] overflow-y-auto border-t-[1.5px] border-line-soft",
  seriesText: "flex min-w-0 flex-1 flex-col py-1.5",
  seriesMeta: "text-[0.85rem] text-ink-soft",
  omnibusNote: "text-[0.8rem] text-accent",
  // a row: the tick and its name, with Edit beside them (not inside the
  // label, where a press would also tick)
  seriesRow:
    "flex items-center gap-2 border-b border-dashed border-line-soft has-[input:disabled]:opacity-50",
  seriesLabel:
    "flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 has-[input:disabled]:cursor-default",
  seriesEdit:
    "tap min-h-11 shrink-0 px-1 text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current disabled:cursor-default disabled:no-underline disabled:hover:text-ink-soft",
  edited: "text-ink",

  // Edit: which AniList series, and how many volumes. A full screen on phones
  modal:
    "m-auto max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] flex-col rounded-ink border-[2.5px] border-line bg-card text-ink shadow-ink-lg open:flex backdrop:bg-[rgba(20,14,8,0.55)] upto-720:h-dvh upto-720:max-h-none upto-720:w-screen upto-720:max-w-none upto-720:rounded-none upto-720:border-0",
  modalForm: "flex min-h-0 flex-1 flex-col",
  modalHead:
    "flex items-start justify-between gap-4 border-b-[1.5px] border-line px-5 pt-4 pb-3",
  modalTitle:
    "font-brand text-[1.5rem] leading-[1.1] font-normal tracking-[0.02em] text-balance uppercase [overflow-wrap:anywhere]",
  modalNow: "mt-1 text-[0.9rem] text-ink-soft",
  modalClose:
    "tap shrink-0 py-1 text-[0.9rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink upto-720:hidden",
  modalBody: "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4",
  modalLabel: "font-display text-[1.05rem] font-medium",
  modalSearch:
    "min-h-11 w-full border-[2.5px] border-line bg-paper px-3 text-[1rem] text-ink outline-none focus-visible:border-accent",
  modalHits: "mb-3 flex flex-col border-t-[1.5px] border-line-soft",
  modalStatus: "py-3 text-[0.9rem] leading-[1.45] text-ink-soft",
  // one AniList series to choose; the chosen one inked in
  modalHit:
    "tap flex min-h-16 w-full items-center gap-3 border-b border-dashed border-line-soft px-2 py-2 text-left transition-colors duration-120 hover:bg-accent-wash aria-checked:bg-ink aria-checked:text-paper aria-checked:hover:bg-ink",
  modalCover:
    "h-14 w-10 shrink-0 border-[1.5px] border-line bg-paper object-cover",
  modalHitName: "block font-medium leading-[1.25] [overflow-wrap:anywhere]",
  modalHitOther:
    "block text-[0.82rem] leading-[1.3] opacity-75 [overflow-wrap:anywhere]",
  modalHitMeta: "block font-mono text-[0.75rem] tabular-nums opacity-75",
  modalNone:
    "tap min-h-12 w-full px-2 py-2 text-left text-[0.9rem] font-medium text-ink-soft transition-colors duration-120 hover:bg-accent-wash hover:text-ink aria-checked:bg-ink aria-checked:text-paper aria-checked:hover:bg-ink aria-checked:hover:text-paper",
  modalVolumes:
    "min-h-11 w-28 border-[2.5px] border-line bg-paper px-3 font-mono text-[1rem] text-ink tabular-nums outline-none focus-visible:border-accent aria-invalid:border-accent",
  modalHint: "text-[0.85rem] leading-[1.45] text-ink-soft",
  modalFoot:
    "flex items-center justify-end gap-3 border-t-[1.5px] border-line px-5 py-3",
  warning:
    "border-[1.5px] border-dashed border-accent bg-accent-wash px-3 py-2 text-[0.9rem] leading-[1.45]",
  note: "mt-3 text-[0.9rem] leading-[1.45] text-ink-soft",
  actions: "mt-5 flex flex-wrap items-center gap-3",

  progressLine: "font-medium",
  // how far it's got, with Stop import beside it (under it on phones)
  matchingLine:
    "mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 [&>p]:mt-0",
  stop: "btn btn-secondary btn-sm",
  // beside Add, as tall as it and quieter
  cancel: "btn btn-ghost btn-lg",
  stopYes: "btn btn-danger btn-sm",
  stopAsk: "flex flex-wrap items-center gap-2 text-[0.9rem] font-medium",
  bar: "mt-2 h-2.5 overflow-hidden border-[1.5px] border-line bg-paper",
  barFill:
    "h-full bg-accent transition-[width] duration-300 ease-ink motion-reduce:transition-none",

  result: "flex flex-col items-center gap-2 text-center",
  resultTitle:
    "font-brand text-[clamp(1.9rem,5vw,2.5rem)] leading-[1.05] font-normal tracking-[0.02em] uppercase",
  resultBody: "max-w-[44ch] leading-[1.5] text-ink-soft",
} as const;

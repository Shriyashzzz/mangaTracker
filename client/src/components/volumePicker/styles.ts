// The bookcase on the add and edit forms (VolumePicker.tsx). Each volume is a
// slot holding a spine; slots sit edge to edge and each draws its piece of
// the shelf underneath, so every wrapped row gets its own shelf line. Theirs
// stand tall and inked; the rest lean, pale and dashed, like the form's
// unpicked tickets (styles/form.ts segmentLabel)
export const volumePickerStyles = {
  field: "flex min-w-0 flex-col gap-[0.35rem]",
  head: "flex flex-wrap items-end justify-between gap-x-4 gap-y-1",
  upTo: "flex items-center gap-2 text-[0.88rem] text-ink-soft",
  upToInput:
    "h-11 w-[4.5rem] rounded-[2px] border-[1.5px] border-line bg-paper px-2 text-center font-mono text-ink transition-[box-shadow,background-color] duration-120 placeholder:text-muted focus:bg-card focus:shadow-[3px_3px_0_var(--accent)] focus:outline-none",

  // a sideways drag paints spines; an up-and-down swipe scrolls the page
  shelf: "flex touch-pan-y flex-wrap items-end gap-y-2 px-0.5 pt-1 select-none",
  slot: "tap group flex h-[86px] w-7 shrink-0 cursor-pointer items-end justify-center border-b-[3px] border-double border-line pb-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:outline-dashed",
  spineUp:
    "flex h-[74px] w-[22px] flex-col items-center justify-end border-[1.5px] border-line bg-ink pb-1 text-paper transition-[height] duration-150 ease-ink motion-reduce:transition-none",
  spineDown:
    "flex h-[58px] w-[22px] origin-bottom-left rotate-[4deg] flex-col items-center justify-end border-[1.5px] border-dashed border-line-soft bg-paper pb-1 text-muted transition-[rotate,height] duration-150 ease-ink group-hover:rotate-0 group-hover:text-ink motion-reduce:transition-none",
  number: "font-brand text-[0.9rem] leading-none tabular-nums",
  // three digits on a 22px spine
  numberSmall:
    "font-brand text-[0.72rem] leading-none tracking-[-0.02em] tabular-nums",
  // a run of full shelves, folded: a box set across its own row, on the
  // same shelf line
  box: "tap group flex h-[86px] basis-full items-end border-b-[3px] border-double border-line px-0.5 pb-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent focus-visible:outline-dashed",
  boxSet:
    "flex h-[74px] w-full items-center justify-between gap-3 border-[1.5px] border-line bg-ink px-4 text-paper shadow-ink transition-transform duration-150 ease-ink group-hover:-translate-y-0.5 motion-reduce:transition-none",
  boxTitle:
    "font-brand text-[1.35rem] leading-none tracking-[0.03em] uppercase",
  boxNote: "text-[0.8rem] text-paper/75",

  foot: "flex flex-wrap items-baseline justify-between gap-x-4",
  footActions: "flex gap-4",
  said: "font-mono text-[0.84rem] text-ink-soft",
  clear:
    "tap text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  note: "text-[0.84rem] text-ink-soft",
} as const;

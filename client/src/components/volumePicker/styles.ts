// The volume picker on the add and edit forms (VolumePicker.tsx). Its tickets
// are the form's status tickets (styles/form.ts segmentLabel): dashed until
// picked, inked in once they are
export const volumePickerStyles = {
  // what's picked, where the number box was
  picked:
    "flex h-11 w-full items-center overflow-hidden rounded-[2px] border-[1.5px] border-line bg-paper px-[0.85rem] font-mono text-[0.92rem] text-ink text-ellipsis whitespace-nowrap",
  toggle:
    "tap self-start text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",

  panel:
    "-mt-1 flex flex-col gap-3 border-[1.5px] border-dashed border-line-soft bg-paper px-4 py-3 animate-drop motion-reduce:animate-none",
  panelHead: "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
  panelTitle: "text-[0.9rem] font-semibold",
  count: "font-normal text-muted",
  quick: "flex gap-3",
  quickBtn:
    "tap text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current",
  // a few rows, then it scrolls: One Piece has 110
  tickets:
    "grid max-h-[9.5rem] grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 overflow-y-auto p-0.5",
  ticket:
    "tap flex h-10 items-center justify-center rounded-[2px] border-[1.5px] border-dashed border-line-soft font-mono text-[0.9rem] text-muted tabular-nums transition-[color,border-color,background-color] duration-120 ease-[ease] hover:border-line hover:text-ink aria-pressed:border-solid aria-pressed:border-line aria-pressed:bg-ink aria-pressed:text-paper",
  more: "tap col-span-2 flex h-10 items-center justify-center text-[0.84rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink",
  note: "text-[0.84rem] text-ink-soft",
  typeRow: "flex flex-wrap items-center gap-x-3 gap-y-1",
  typeLabel: "text-[0.84rem] text-ink-soft",
  typeInput: "h-9 max-w-[16rem] flex-1 font-mono text-[0.88rem]",
  bad: "text-[0.84rem] font-medium text-accent",
} as const;

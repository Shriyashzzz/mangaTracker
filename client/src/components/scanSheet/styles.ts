// The barcode scanner (ScanSheet.tsx). The camera half stays dark in every
// theme, as a viewfinder does; the list of what was scanned is paper.
export const scanStyles = {
  // the whole screen on phones; a panel on wider screens, sized to a webcam
  dialog:
    "m-auto w-[min(30rem,calc(100vw-2rem))] max-w-none flex-col overflow-hidden border-[2.5px] border-line bg-[#0e0c09] p-0 text-[#f3eee2] shadow-ink-lg open:flex backdrop:bg-[rgba(20,14,8,0.6)] upto-720:h-dvh upto-720:max-h-none upto-720:w-screen upto-720:border-0",
  top: "flex items-center justify-between px-3 pt-3 pb-1",
  title:
    "font-brand text-[1.4rem] leading-none font-normal tracking-[1px] uppercase",
  round:
    "grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-[rgba(243,238,226,0.5)] bg-[rgba(0,0,0,0.35)] text-[#f3eee2] aria-pressed:bg-[#f3eee2] aria-pressed:text-[#0e0c09] disabled:invisible [&_svg]:size-5",
  camera:
    "relative grid min-h-0 flex-1 place-items-center content-center gap-4 overflow-hidden bg-[radial-gradient(120%_80%_at_50%_40%,#3a332a,#120f0b_70%)] px-4 py-2",
  // typing instead: the dark panel shrinks to a note, the list gets the room.
  // Wider screens: the sheet is camera-sized only while the camera shows,
  // so typing leaves no empty panel; phones are always the full screen
  dialogCamera: "h-[min(46rem,92dvh)]",
  cameraTyping:
    "relative grid flex-none place-items-center bg-[#120f0b] px-4 py-6 upto-720:flex-1",
  video: "absolute inset-0 size-full object-cover",
  // the box the barcode goes in, drawn in ink like a manga panel's border
  frame:
    "relative aspect-[16/9] w-[min(78%,22rem)] border-[3px] border-[#f3eee2] outline-[3px] outline-[#0e0c09] transition-colors duration-150 data-read:border-accent",
  laser:
    "absolute inset-x-[6%] h-0.5 animate-[scan-sweep_1.8s_ease-in-out_infinite_alternate] bg-accent motion-reduce:hidden",
  hint: "relative m-0 bg-[rgba(14,12,9,0.82)] px-3 py-2 text-center text-[0.95rem] text-balance text-[#f3eee2]",
  hintSmall: "mt-1 block text-[0.8rem] text-[#b9b09c]",
  blocked:
    "relative grid max-w-[22rem] gap-2 text-center text-[0.95rem] text-balance text-[#e8e0cc]",
  // what the last scan came to, big over the camera for a moment
  flash:
    "pointer-events-none absolute inset-x-6 top-1/2 z-10 grid -translate-y-1/2 animate-card-in gap-1 border-[2.5px] border-[#0e0c09] bg-[#f3eee2] px-4 py-3 text-center text-[#1d1a16] shadow-[4px_4px_0_#0e0c09] motion-reduce:animate-none",
  flashGood: "bg-[#e3f1e6]! text-[#1f4a2e]",
  flashBad: "bg-[#f6e3df]! text-[#7a2b20]",
  results:
    "grid gap-2 border-t-[3px] border-line bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink",
  list: "grid max-h-44 gap-2 overflow-y-auto",
  listTall: "grid max-h-[40dvh] gap-2 overflow-y-auto",
  empty: "m-0 text-[0.9rem] text-muted",
  row: "grid animate-card-in grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-[1.5px] border-dashed border-line-soft bg-paper px-3 py-2 motion-reduce:animate-none",
  // the row the last scan made
  rowNew: "border-solid! border-accent! bg-accent-wash!",
  // a row's buttons, side by side
  rowActions: "flex items-center gap-x-3",
  rowTitle: "block truncate text-[0.95rem] font-semibold",
  rowNote: "flex items-center gap-1 text-[0.82rem] text-ink-soft",
  rowGood: "text-[#2f6b45] dark:text-[#7cc293]",
  rowBad: "text-accent",
  link: "tap min-h-11 px-1 text-[0.9rem] font-medium underline decoration-line-soft underline-offset-3 hover:decoration-current",
  typed: "grid grid-cols-[minmax(0,1fr)_auto] gap-2",
  input:
    "min-h-12 min-w-0 border-2 border-line bg-paper px-3 font-mono text-[1rem] text-ink outline-none placeholder:text-ink-soft focus-visible:border-accent",
  typedError: "col-span-full m-0 text-[0.85rem] text-accent",
  footer: "flex items-center justify-between",
  // on the dark panel: the camera refused, ask again
  retry:
    "tap mx-auto min-h-11 px-1 text-[0.95rem] font-medium text-[#f3eee2] underline decoration-[rgba(243,238,226,0.5)] underline-offset-3 hover:decoration-current",
  count: "font-mono text-[0.8rem] text-muted tabular-nums",
  done: "btn btn-primary min-h-12 w-full",
};

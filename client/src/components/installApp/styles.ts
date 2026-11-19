// The "Put it on your home screen" sheet. The dialog is the shelf's confirm
// dialog (Home/styles.ts confirm) on laptops and tablets; on a phone it
// rises from the bottom like the shared shelf's series sheet, near Safari's
// own bar, where the Share button is.
export const installStyles = {
  dialog:
    "m-auto w-[min(26rem,calc(100vw-2rem))] rounded-ink border-[2.5px] border-line bg-card p-0 text-ink shadow-ink-lg backdrop:bg-[rgba(20,14,8,0.55)] upto-720:mb-0 upto-720:w-screen upto-720:max-w-none upto-720:rounded-none upto-720:border-x-0 upto-720:border-b-0 upto-720:open:animate-sheet-up",
  box: "p-5 upto-720:pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
  title:
    "font-brand text-[1.7rem] leading-[1.05] font-normal tracking-[0.02em] text-balance uppercase",
  lead: "mt-1 text-[0.95rem] leading-[1.5] text-ink-soft",
  steps: "mt-4 flex flex-col gap-2",
  // a step: its number in an ink square, then what to tap
  step: "grid grid-cols-[2.1rem_1fr] items-center gap-3 border-2 border-line bg-paper px-3 py-2.5 text-[0.95rem] leading-[1.35] [&_strong]:font-semibold [&_strong]:text-ink",
  stepNumber:
    "grid size-[2.1rem] place-items-center bg-ink font-brand text-[1.25rem] leading-none text-paper",
  // Safari's own Share mark, in Safari's blue, so it's the one they look for
  share: "mx-0.5 inline-block size-[1.1em] -translate-y-px text-[#2f6fe4]",
  notes: "mt-3 flex flex-col gap-1 text-[0.85rem] leading-[1.45] text-ink-soft",
  actions: "mt-4 flex justify-end upto-720:[&>*]:w-full",
};

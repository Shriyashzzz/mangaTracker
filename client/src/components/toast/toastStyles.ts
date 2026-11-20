// A note pinned to the bottom of the screen for a few seconds: "Deleted:
// Berserk · Undo" (components/deletedNote), "Added vol. 2 of Blue Box to
// your shelf · See it" (components/toast/Toast.tsx). One look for both.
export const toastBox =
  "fixed inset-x-0 bottom-6 z-15 mx-auto flex w-fit max-w-[min(30rem,calc(100vw-2rem))] animate-drop items-center gap-4 rounded-ink border-[2.5px] border-line bg-card px-4 py-3 text-[0.95rem] text-ink shadow-ink motion-reduce:animate-none upto-720:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]";
export const toastAction =
  "tap shrink-0 font-medium text-ink underline decoration-accent decoration-2 underline-offset-3";

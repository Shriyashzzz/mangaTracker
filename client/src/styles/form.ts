// Tailwind classes for the add and edit manga forms (AddManga, UpdateManga).
// Sized so the whole form sits in one laptop viewport without scrolling;
// short laptop screens (short-laptop) tuck the pitch line away, phones
// (upto-760) stack everything in one column.

// a text field's look; textarea and select build on it
const input =
  "h-[42px] w-full rounded-[2px] border-[1.5px] border-line bg-paper px-[0.85rem] transition-[box-shadow,background-color] duration-120 ease-[ease] placeholder:text-muted placeholder:opacity-80 focus:bg-card focus:shadow-[3px_3px_0_var(--accent)] focus:outline-none";

// the label above a field; <b> is the required star
const label = "text-[0.9rem] font-semibold [&_b]:text-accent";

export const formStyles = {
  page: "mx-auto max-w-[900px] upto-760:mt-0",
  // back link + title on the left, the one-line pitch on the right
  pageHead:
    "mb-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 short-laptop:mb-[0.85rem] short-laptop:[&>div]:flex short-laptop:[&>div]:items-baseline short-laptop:[&>div]:gap-5",
  backLink:
    "mb-[0.15rem] inline-block text-[0.85rem] text-muted underline-offset-3 hover:text-ink hover:underline short-laptop:mb-0",
  formTitle: "text-[clamp(1.9rem,3.4vw,2.3rem)] leading-[1.05] font-medium",
  formSub:
    "max-w-sm text-[0.95rem] leading-[1.45] text-ink-soft short-laptop:hidden",

  // one sheet: the cover column beside the details. The title comes first
  // in the markup (it's what you type first, and it drives the cover
  // lookup); on phones it's title, then the cover row, then the rest
  sheet:
    "grid grid-cols-[172px_minmax(0,1fr)] grid-rows-[auto_1fr] gap-x-9 gap-y-[0.95rem] border-[1.5px] border-line bg-card p-[clamp(1.1rem,2.5vw,1.5rem)] shadow-[6px_6px_0_var(--hard-shadow)] upto-760:grid-cols-[minmax(0,1fr)] upto-760:grid-rows-none upto-760:gap-5",
  coverArea:
    "col-start-1 row-span-2 row-start-1 upto-760:row-span-1 upto-760:row-start-2",
  titleField: "col-start-2 row-start-1 upto-760:col-start-1",
  details:
    "col-start-2 row-start-2 flex min-w-0 flex-col gap-[0.95rem] upto-760:col-start-1 upto-760:row-start-3",
  // notes soak up whatever height is left so both columns end together
  notesField: "flex-1",
  labelRow: "flex items-baseline justify-between",
  counter: "font-mono text-[0.72rem] text-muted",
  // chapter, volumes and genre side by side; stacked on small phones so
  // long genres fit
  row: "grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-5 upto-480:grid-flow-row",

  field: "flex min-w-0 flex-col gap-[0.35rem]",
  label,
  fieldLabel: label,
  optional: "text-[0.82rem] font-normal text-muted",

  input,
  textarea: `${input} h-auto min-h-16 flex-1 resize-y px-[0.85rem] py-[0.7rem] leading-[1.6]`,
  select: `${input} select-chevron cursor-pointer pr-[2.2rem]`,

  // status choice: two radio "tickets". The radios are hidden; each label
  // after a checked radio is inked in
  segmented:
    "flex gap-3 [&>input]:pointer-events-none [&>input]:absolute [&>input]:opacity-0",
  segmentLabel:
    "flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[2px] border-[1.5px] border-dashed border-line-soft text-[0.92rem] font-medium text-muted transition-[color,border-color,background-color] duration-120 ease-[ease] hover:border-line hover:text-ink [input:checked+&]:border-solid [input:checked+&]:border-line [input:checked+&]:bg-ink [input:checked+&]:text-paper [input:focus-visible+&]:outline-2 [input:focus-visible+&]:outline-offset-3 [input:focus-visible+&]:outline-accent [input:focus-visible+&]:outline-dashed",

  errorList:
    "flex flex-col gap-1 border-[1.5px] border-accent bg-accent-wash px-[0.95rem] py-[0.7rem] text-[0.9rem] text-accent",
  btnContainer:
    "mt-auto flex items-center justify-end gap-4 upto-480:flex-col-reverse upto-480:items-stretch",
} as const;

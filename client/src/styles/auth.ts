// Tailwind classes for the sign in / sign up spread, shared by SignIn,
// SignUp, ForgotPassword, ResetPassword, AuthArt and PasswordInput. One place to restyle both pages.
// Phones (upto-720) stack the art above the form as a short strip. On a
// short phone screen (an iPhone SE, 667px tall) the art goes under the form
// instead: above it, it pushed the form's button below the bottom bar, and
// the form looked like it had none.

// "Don't have an account? Sign up": quiet words, the link inked and
// underlined in red. The signed-out shelf's "Already have a shelf? Sign in"
// reads the same (pages/Home/GuestHero.tsx)
const switchText =
  "text-[0.925rem] text-ink-soft [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_a]:decoration-accent [&_a]:underline-offset-3";

export const authStyles = {
  // the page: centers the spread
  container: "grid place-items-center py-[clamp(0.5rem,3vw,2rem)]",
  // white gutters around two inked panels, like a manga spread
  spread:
    "grid w-full max-w-[860px] grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] gap-3 border-[1.5px] border-line-soft bg-card p-3 upto-720:max-w-[460px] upto-720:grid-cols-[minmax(0,1fr)] upto-720:gap-[9px] upto-720:p-[9px]",

  // ---------- art panel ----------
  art: "relative flex min-h-[420px] flex-col overflow-hidden border-3 border-line bg-paper upto-720:min-h-0 upto-720:[@media(max-height:700px)]:order-last",
  // focus lines radiating from the chapter number
  speed:
    "focus-lines grid flex-1 place-items-center upto-720:absolute upto-720:inset-0 upto-720:[place-items:start_center] upto-720:pt-[74px]",
  bigCh:
    "bg-paper px-[0.25em] py-[0.05em] font-brand text-[clamp(4rem,10vw,6rem)] leading-none tracking-[0.02em] text-ink upto-720:hidden [&_small]:mr-[0.1em] [&_small]:text-[0.42em] [&_small]:text-accent",
  sfx: "absolute top-[34px] right-[22px] left-[18px] origin-left -rotate-5 font-brand text-[clamp(2rem,4.4vw,2.8rem)] leading-[0.95] tracking-[0.03em] text-balance text-accent uppercase [-webkit-text-stroke:1.5px_var(--line)] [paint-order:stroke_fill] upto-720:relative upto-720:inset-auto upto-720:mx-4 upto-720:mt-3 upto-720:mb-2.5 upto-720:text-center upto-720:text-[1.5rem] upto-720:rotate-[-2deg] upto-720:origin-center",
  // the same lettering where there's no chapter number: in the middle of the
  // lines on laptops (sfxMiddle), and as it always was on phones (sfxPhone)
  sfxMiddle:
    "max-w-[82%] -rotate-5 bg-paper px-[0.3em] py-[0.12em] text-center font-brand text-[clamp(2.4rem,5.2vw,3.4rem)] leading-[0.95] tracking-[0.03em] text-balance text-accent uppercase [-webkit-text-stroke:1.5px_var(--line)] [paint-order:stroke_fill] upto-720:hidden",
  sfxPhone:
    "hidden upto-720:block absolute top-[34px] right-[22px] left-[18px] origin-left -rotate-5 font-brand text-[clamp(2rem,4.4vw,2.8rem)] leading-[0.95] tracking-[0.03em] text-balance text-accent uppercase [-webkit-text-stroke:1.5px_var(--line)] [paint-order:stroke_fill] upto-720:relative upto-720:inset-auto upto-720:mx-4 upto-720:mt-3 upto-720:mb-2.5 upto-720:text-center upto-720:text-[1.5rem] upto-720:rotate-[-2deg] upto-720:origin-center",
  // speech balloon, tail pointing up toward the action
  bubble:
    "bubble-tail-up relative mx-[1.1rem] mb-5 rounded-[48%_52%_50%_50%/56%_52%_48%_44%] border-[2.5px] border-line bg-card px-[2.4rem] py-[1.3rem] text-center font-letter text-[0.95rem] leading-[1.35] font-bold tracking-[0.02em] uppercase upto-720:mx-[0.8rem] upto-720:mb-[0.9rem] upto-720:px-[1.7rem] upto-720:py-[0.95rem] upto-720:text-[0.82rem]",

  // ---------- form panel ----------
  card: "flex flex-col justify-center border-3 border-line bg-paper p-[clamp(1.5rem,4vw,2.5rem)]",
  // (on a short phone the title and the boxes sit closer, so sign-up's
  // three boxes and its button all clear the bottom bar)
  title:
    "mb-6 upto-720:[@media(max-height:700px)]:mb-4 font-brand text-[clamp(2.4rem,5vw,3rem)] leading-none font-normal tracking-[0.02em] uppercase",
  fields:
    "flex flex-col gap-[1.15rem] upto-720:[@media(max-height:700px)]:gap-3",
  field:
    "flex flex-col gap-[0.4rem] [&_label]:font-letter [&_label]:text-[0.9rem] [&_label]:font-bold [&_label]:tracking-[0.04em] [&_label]:uppercase",
  // wraps an input that has a button inside it (show password)
  inputWrap: "relative [&_input]:pr-12",
  input:
    "h-[46px] w-full rounded-[2px] border-2 border-line bg-card px-[0.85rem] transition-[box-shadow,background-color] duration-120 ease-[ease] placeholder:text-muted placeholder:opacity-80 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-wash)] focus:outline-none aria-invalid:border-accent",
  reveal:
    "absolute top-px right-px grid size-11 place-items-center text-muted hover:text-ink [&_svg]:size-[18px]",
  hint: "font-mono text-[0.72rem] text-muted",
  // the same hint, now the problem: in the error's colour
  hintError: "font-mono text-[0.72rem] font-semibold text-accent",
  // a line or two under the title saying what this page is for (forgot
  // and reset password)
  lead: "mb-5 text-[0.975rem] leading-[1.5] text-ink-soft",
  // short notes under the lead: how long the link lasts, where to look
  notes:
    "mb-5 flex list-disc flex-col gap-1 pl-5 text-[0.925rem] text-ink-soft",
  // "Forgot password?" under the sign-in password box; padded for a thumb
  forgot:
    "-my-1 self-end py-1 text-[0.85rem] font-semibold text-ink underline decoration-accent underline-offset-3",
  // "Sent again." under its button; keeps its line so nothing jumps
  sentAgain:
    "mt-2 min-h-[1.2em] text-center font-mono text-[0.72rem] text-muted",
  // a shouted caption box, tilted like a panel interruption
  error:
    "-rotate-[0.6deg] border-2 border-accent bg-accent-wash px-[0.9rem] py-[0.65rem] text-[0.9rem] font-medium text-accent",
  errorList:
    "flex -rotate-[0.6deg] flex-col gap-1 border-2 border-accent bg-accent-wash px-[0.9rem] py-[0.65rem] text-[0.9rem] font-medium text-accent",
  submit: "mt-2",
  switchRow: `mt-6 border-t-2 border-dashed border-line-soft pt-5 ${switchText}`,
  switchText,
} as const;

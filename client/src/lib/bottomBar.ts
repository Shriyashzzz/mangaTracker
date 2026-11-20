// The phone layout, bottom bar and all: phones, and touch screens up to
// 1400px (tablets). The same query as index.css's upto-720.
export const PHONE_LAYOUT =
  "(max-width: 720px) or ((pointer: coarse) and (max-width: 1400px))";

// The bottom bar hides while an input has focus, to leave room for the keyboard,
// so a box that focuses itself would take the bar away on arrival. By width as
// well as device: a narrow window on a laptop gets the bar too
export const hasBottomBar = () => window.matchMedia(PHONE_LAYOUT).matches;

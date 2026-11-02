// The bottom bar hides while an input has focus, to leave room for the keyboard,
// so a box that focuses itself would take the bar away on arrival. By width as
// well as device: a narrow window on a laptop gets the bar too
export const hasBottomBar = () => window.matchMedia("(max-width: 720px)").matches;

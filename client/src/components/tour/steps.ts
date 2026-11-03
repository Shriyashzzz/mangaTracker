// Kenji's script. A step points at the page element marked data-tour="<target>".
// `tap` means the person moves on by tapping the real thing, and it really happens;
// `button` is the word on Kenji's own button, for what only needs explaining.
export type TourStep = {
  // the page this step is on; the tour takes them there if the last step didn't
  path: string;
  target?: string;
  say: string;
  tap?: boolean;
  button?: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    path: "/shelf",
    target: "shelf",
    say: "Hey, I'm Kenji! This is your shelf, every series you're reading. It's a practice one, so try anything. Nothing gets saved.",
    button: "Let's go",
  },
  {
    path: "/shelf",
    target: "add",
    say: "Started something new? Tap here to add it.",
    tap: true,
  },
  {
    path: "/add",
    target: "add-title",
    say: "Type a title and pick the match. The cover and genre fill in for you. Let's head back and open one you already have.",
    button: "Back to the shelf",
  },
  {
    path: "/shelf",
    target: "card",
    say: "Tap a manga to open its page.",
    tap: true,
  },
  {
    path: "/details/",
    target: "chapter-up",
    say: "Finished a chapter? One tap and your place is saved. Try it!",
    tap: true,
  },
  {
    path: "/details/",
    target: "rating",
    say: "Nice! Now rate it. Tap a star.",
    tap: true,
  },
  {
    path: "/details/",
    target: "notes",
    say: "Anything you want to remember goes here, and it saves by itself.",
    button: "Got it",
  },
  {
    path: "/details/",
    say: "That's the basics! There's more to explore, like new release alerts and price checks. Ready for a shelf of your own?",
  },
];

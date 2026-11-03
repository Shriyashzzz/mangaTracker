// Kenji's script. A step points at the page element marked data-tour="<target>".
// `tap` means the person moves on by using the real thing, and it really happens.
// `button` is the word on Kenji's own button, for what only needs explaining.
export type TourStep = {
  // the page this step is on: anything under this path counts
  path: string;
  // where to take them if they aren't there, when `path` alone isn't a page
  go?: string;
  // only this exact path counts, for "/" which everything starts with
  exact?: boolean;
  target?: string;
  say: string;
  tap?: boolean;
  button?: string;
  // one of the few big moments: everything but the target blurs. Otherwise the
  // page stays clear and usable, and Kenji just points
  focus?: boolean;
  // nothing to point at: the page is theirs until they press Kenji's button
  free?: boolean;
  // sit in the corner, clear of what using the target opens up
  dock?: boolean;
  // leaving this page means they're done with it, like adding a manga opens that
  // manga's page, so coming back to the tour carries on instead of returning here
  doneOnLeaving?: boolean;
  // open the shelf on All, rather than the tab they last had
  allTab?: boolean;
};

// One Piece: the practice manga with a new volume, so the red bar steps always use it
const MANGA = "/details/1";

export const TOUR_STEPS: TourStep[] = [
  {
    path: "/shelf",
    target: "shelf",
    focus: true,
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
    say: "Type a title and pick the match. The cover and genre fill in for you.",
    button: "Next",
    dock: true,
    doneOnLeaving: true,
  },
  {
    path: "/shelf",
    target: "card",
    say: "Tap a manga to open its page.",
    tap: true,
  },
  {
    path: "/details/",
    go: MANGA,
    target: "chapter-up",
    say: "Finished a chapter? One tap and your place is saved. Try it!",
    tap: true,
  },
  {
    path: "/details/",
    go: MANGA,
    target: "rating",
    say: "Nice! Now rate it. Tap a star.",
    tap: true,
  },
  {
    path: "/details/",
    go: MANGA,
    target: "notes",
    say: "Now write yourself a note, go on! Favorite arc, where you left off, anything. It saves by itself.",
    button: "Done writing",
  },
  {
    path: "/details/",
    go: MANGA,
    free: true,
    say: "This page is all yours for a minute. Poke around, then tap below when you're ready.",
    button: "Keep going",
  },
  {
    path: MANGA,
    target: "release-toggle",
    focus: true,
    say: "Psst! This red bar means something new is out, and it's past where you are. Tap it to see the dates.",
    tap: true,
  },
  {
    path: MANGA,
    target: "release-dates",
    say: "Here's what's out and when the next one should land. Volumes show volume dates, chapters show chapter dates.",
    button: "Got it",
  },
  {
    path: MANGA,
    target: "buy",
    say: "Want a copy? This takes you to its prices. Tap it!",
    tap: true,
  },
  {
    path: "/prices/",
    go: "/prices/9780000000041",
    target: "offers",
    say: "Every store we found, cheapest first, new and used. These prices are made up for the tour. Real ones also get a price history.",
    button: "Got it",
  },
  {
    path: "/",
    exact: true,
    target: "price-search",
    say: "Looking for something that isn't on your shelf? Search any series here and compare its volumes.",
    button: "Nice",
  },
  {
    path: "/shelf",
    target: "tab-new",
    focus: true,
    say: "Now my favorite. The New tab checks your whole shelf for you. Tap it!",
    tap: true,
  },
  {
    path: "/shelf",
    target: "shelf",
    say: "Everything that's come out past where you are. Already got it, or don't care? Hide takes it off the list until something newer is out.",
    button: "Got it",
  },
  {
    path: "/settings/new-releases",
    target: "new-controls",
    say: "You choose how much New lists: just the next one, anything within a few, or everything that's out. You can also switch these checks off.",
    button: "Good to know",
  },
  {
    path: "/updates",
    target: "updates",
    say: "Wondering what's changed on the site? New features land here, under What's new in the footer.",
    button: "Cool",
  },
  {
    path: "/settings/profile",
    target: "profile-picture",
    say: "Time to make it yours. Pick a silly picture, and a name if you want one.",
    button: "Next",
  },
  {
    path: "/settings/profile",
    target: "share-toggle",
    focus: true,
    say: "Want friends to see your list? Tick this. It's off until you say so.",
    tap: true,
  },
  {
    path: "/settings/profile",
    target: "share-link",
    say: "That's your link! Anyone who has it can see your shelf, and your notes only if you tick Include my notes. Your username stays private.",
    button: "Got it",
  },
  {
    path: "/settings/shelf",
    target: "view-rows",
    say: "Big covers not your thing? Tap this for compact rows, so more manga fit on a screen.",
    tap: true,
  },
  {
    path: "/shelf",
    target: "shelf",
    allTab: true,
    say: "Same shelf, way more on one screen. In settings you can switch back any time, and choose which tab it opens on and how it's sorted.",
    button: "Love it",
  },
  {
    path: "/settings/appearance",
    target: "theme",
    say: "Reading late? Try a theme. Tap one and the whole site changes. There are backgrounds to pick from just below too.",
    tap: true,
  },
  {
    path: "/settings/prices",
    target: "hide-ebooks",
    say: "Only buy print? This hides ebooks from the price lists.",
    button: "Next",
  },
  {
    path: "/import",
    target: "import",
    say: "Already keep a list on MyAnimeList? Follow these steps and your whole list comes over in one go.",
    button: "Next",
  },
  {
    path: "/settings/account",
    target: "export",
    say: "And it's your data. Download your list any time, or delete your account from this same page.",
    button: "Last one",
  },
  {
    path: "/settings/account",
    focus: true,
    say: "That's everything! You've seen the whole shelf. Ready for one of your own?",
  },
];

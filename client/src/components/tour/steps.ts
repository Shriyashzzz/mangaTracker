// Kenji's script. A step points at the page element marked data-tour="<target>".
// `tap` means the person moves on by using the real thing, and it really happens.
// `button` is the word on Kenji's own button, for what only needs explaining.
type Line = {
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

// Grouped the way the site is, so the tour goes through one place at a time instead
// of jumping around. Kenji's bubble shows the part and how far along it they are.
const PARTS: { name: string; lines: Line[] }[] = [
  {
    name: "My shelf",
    lines: [
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
        path: "/import",
        target: "import",
        say: "Got a long list on MyAnimeList already? Follow these steps and the whole thing comes over in one go.",
        button: "Next",
      },
      {
        path: "/shelf",
        target: "card",
        say: "Tap a manga to open its page.",
        tap: true,
      },
    ],
  },
  {
    name: "My shelf: a manga",
    lines: [
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
    ],
  },
  {
    name: "My shelf: New tab",
    lines: [
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
        path: "/shelf",
        target: "how-new-works",
        say: "Wondering how I know what's new, behind your shelf? Tap here.",
        tap: true,
      },
      {
        path: "/new-releases",
        free: true,
        say: "I compare what's out with the volumes you own, or else the chapter you're on. That's why a series with neither saved never shows up. Read as much as you like.",
        button: "Next",
      },
    ],
  },
  {
    name: "Prices",
    lines: [
      {
        path: "/",
        target: "tab-prices",
        say: "Now the other tab. Prices shows what a volume costs across stores, and you don't need it on your shelf. Tap it!",
        tap: true,
      },
      {
        path: "/",
        exact: true,
        target: "price-search",
        say: "Looking for something that isn't on your shelf? Search any series here and compare its volumes.",
        button: "Nice",
      },
      {
        path: "/prices/",
        go: "/prices/9780000000041",
        target: "offers",
        say: "Every store we found, cheapest first. The Buy button on that red bar lands here too. These prices are made up for the tour. Real ones also get a price history.",
        button: "Got it",
      },
    ],
  },
  {
    name: "Settings",
    lines: [
      {
        path: "/settings/profile",
        target: "profile-picture",
        say: "Last stretch: your settings, behind your picture up top. Pick a silly picture here, and a name if you want one.",
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
        path: "/settings/appearance",
        target: "theme",
        say: "Reading late? Try a theme. Tap one and the whole site changes. There are backgrounds to pick from just below too.",
        tap: true,
      },
      {
        path: "/settings/new-releases",
        target: "new-controls",
        say: "Too much on your New list, or too little? You decide: just the next one, only when you're close to the newest, or everything that's out. You can switch the checks off here too.",
        button: "Good to know",
      },
      {
        path: "/settings/prices",
        target: "hide-ebooks",
        say: "Only buy print? This hides ebooks from the price lists.",
        button: "Next",
      },
      {
        path: "/settings/account",
        target: "export",
        say: "And it's your data. Download your list any time, or delete your account from this same page.",
        button: "Next",
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
    ],
  },
  {
    name: "Last stop",
    lines: [
      {
        path: "/updates",
        target: "updates",
        say: "One more place. New features land here, under What's new in the footer.",
        button: "Cool",
      },
      {
        path: "/shelf",
        focus: true,
        say: "That's everything! You've seen the whole shelf. Ready for one of your own?",
      },
    ],
  },
];

export type TourStep = Line & { part: string; partStep: number; partSize: number };

export const TOUR_STEPS: TourStep[] = PARTS.flatMap(({ name, lines }) =>
  lines.map((line, i) => ({
    ...line,
    part: name,
    partStep: i + 1,
    partSize: lines.length,
  })),
);

// Kenji's script. A step points at the page element marked data-tour="<target>".
// Kenji's button is always Next, so moving on is one thing to learn. On a `tap` step
// using the real thing moves on too, and Next does the real thing for them.
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
  // one of the few big moments: everything but the target blurs. Otherwise the
  // page stays clear and usable, and Kenji just points
  focus?: boolean;
  // nothing to point at: the page is theirs until they press Kenji's button
  free?: boolean;
  // can be looked at but not used, like a search box that would open over Kenji
  lookOnly?: boolean;
  // leaving this page means they're done with it, like adding a manga opens that
  // manga's page, so coming back to the tour carries on instead of returning here
  doneOnLeaving?: boolean;
  // a switch that makes the next step's target appear: using it again would hide
  // that, so the tour only moves on once it's showing
  opensNext?: boolean;
  // only there after the step before, so Back skips over it: the red bar's dates
  needsLastStep?: boolean;
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
      },
      {
        path: "/shelf",
        target: "add",
        allTab: true,
        say: "Started something new? This adds it to your shelf.",
        tap: true,
      },
      {
        path: "/add",
        target: "add-title",
        say: "Type a title and pick the match. The cover and genre fill in for you.",
        doneOnLeaving: true,
      },
      {
        path: "/shelf",
        target: "import-link",
        allTab: true,
        say: "Got a long list on MyAnimeList already? This brings the whole thing over in one go.",
      },
      {
        path: "/shelf",
        target: "card",
        allTab: true,
        say: "Every manga has its own page. Let's open this one.",
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
        say: "Finished a chapter? One tap here saves your place.",
        tap: true,
      },
      {
        path: "/details/",
        go: MANGA,
        target: "rating",
        say: "Now rate it. Pick a star, if you like.",
        tap: true,
      },
      {
        path: "/details/",
        go: MANGA,
        target: "notes",
        say: "Write yourself a note here. Favorite arc, where you left off, anything. It saves by itself.",
      },
      {
        path: "/details/",
        go: MANGA,
        free: true,
        say: "This page is all yours. Look around as long as you like.",
      },
      {
        path: MANGA,
        target: "release-toggle",
        opensNext: true,
        focus: true,
        say: "Psst! This red bar means something new is out, past where you are. It opens to show the dates.",
        tap: true,
      },
      {
        path: MANGA,
        target: "release-dates",
        needsLastStep: true,
        say: "Here's what's out and when the next one should land. Volumes show volume dates, chapters show chapter dates.",
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
        say: "Now my favorite. The New tab checks your whole shelf for you.",
        tap: true,
      },
      {
        path: "/shelf",
        target: "shelf",
        say: "You'll see here when a new volume or chapter comes out for a manga on your shelf. Already got it? Hide takes it off the list until something newer is out.",
      },
      {
        path: "/shelf",
        target: "how-new-works",
        say: "Wondering how I know what's new, behind your shelf? This explains it.",
        tap: true,
      },
      {
        path: "/new-releases",
        free: true,
        say: "This is how I know what's new. Read as much as you like.",
      },
      {
        path: "/settings/new-releases",
        target: "new-controls",
        say: "Too much on your New list, or too little? You decide here, and you can switch the checks off too.",
      },
    ],
  },
  {
    name: "Prices",
    lines: [
      {
        path: "/",
        target: "tab-prices",
        say: "Now the other tab. Prices shows what a volume costs across stores, even if it isn't on your shelf.",
        tap: true,
      },
      {
        path: "/",
        exact: true,
        target: "price-search",
        lookOnly: true,
        say: "After the tour, search any series here and compare its volumes. Typing is off for now.",
      },
      {
        path: "/prices/",
        go: "/prices/9780000000041",
        target: "offers",
        say: "Every store we found, cheapest first. The Buy button on that red bar lands here too. These prices are made up for the tour. Real ones also get a price history.",
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
      },
      {
        path: "/settings/profile",
        target: "share-toggle",
        opensNext: true,
        focus: true,
        say: "Want friends to see your list? This turns sharing on. It's off until you say so.",
        tap: true,
      },
      {
        path: "/settings/profile",
        target: "share-link",
        say: "That's your link! Anyone who has it can see your shelf, and your notes only if you tick Include my notes. Your username stays private.",
      },
      {
        path: "/settings/prices",
        target: "hide-ebooks",
        say: "Only buy print? This hides ebooks from the price lists.",
      },
      {
        path: "/settings/account",
        target: "export",
        say: "And it's your data. Download your list any time, or delete your account from this same page.",
      },
      {
        path: "/settings/shelf",
        target: "view-rows",
        say: "Big covers not your thing? Compact rows fit more manga on a screen.",
        tap: true,
      },
      {
        path: "/shelf",
        target: "shelf",
        allTab: true,
        say: "Same shelf, way more on one screen. In settings you can switch back any time, and choose which tab it opens on and how it's sorted.",
      },
    ],
  },
  {
    name: "Last stop",
    lines: [
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

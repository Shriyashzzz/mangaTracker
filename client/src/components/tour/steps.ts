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
  // what he says instead on phones, where the thing he points at differs
  phoneSay?: string;
  // what he says instead to someone who already had an account before the tour
  signedInSay?: string;
  // on phones the target lives in the header menu, so he opens it first
  inMenuOnPhone?: boolean;
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
  // a big page he'd cover: he sits above it instead, scrolling with it
  onTop?: boolean;
  // on a wide enough screen, beside the section's right edge instead
  besideIfRoom?: boolean;
  // a step on the shelf: which of its tabs it's on. The shelf opens on that
  // tab for it, and any other tab counts as having wandered off
  tab?: "all" | "new";
};

// the practice manga (lib/demo.ts): the one with a new volume, so the steps
// on a series' page are about it and only it
const MANGA = "/details/1";
// its newest volume's price page; the ISBN is demo.ts isbnOf(NEW_VOLUME)
const PRICE_PAGE = "/prices/9780000000015";

// Eleven steps: the shelf, one series, the New tab, a price. Grouped the way
// the site is, so the tour goes through one place at a time instead of
// jumping around. Settings isn't on it: nobody needs settings explained
// before they have a shelf.
const PARTS: { name: string; lines: Line[] }[] = [
  {
    name: "My shelf",
    lines: [
      {
        path: "/shelf",
        tab: "all",
        target: "shelf",
        focus: true,
        onTop: true,
        say: "Hi, I'm Kenji! This is a practice shelf, so wander off and explore any part of it during the tour.",
      },
      {
        path: "/shelf",
        target: "add",
        tab: "all",
        say: "Started something new? This adds it. Type a title and pick the match.",
      },
      {
        path: "/shelf",
        target: "import-link",
        tab: "all",
        say: "Keeping a list on MyAnimeList, Goodreads or another app? This brings it over in one go.",
        phoneSay:
          "Keeping a list on MyAnimeList, Goodreads or another app? Import your list lives here in the menu, and brings it over in one go.",
        inMenuOnPhone: true,
      },
      {
        path: "/shelf",
        target: "card",
        tab: "all",
        say: "Every manga has its own page. Let's open this one.",
        tap: true,
      },
    ],
  },
  {
    name: "A manga",
    lines: [
      {
        path: MANGA,
        exact: true,
        target: "chapter-up",
        say: "Finished a chapter? One tap here saves your place.",
        tap: true,
      },
      {
        path: MANGA,
        exact: true,
        target: "spines",
        // the second half is the point of naming Edit: our list can be a
        // volume short, and the edit page takes any volume number
        say: 'Each book is a volume. Tap one to mark it yours. Own one that isn\'t shown? Add it in "Edit details" below.',
      },
      {
        path: MANGA,
        exact: true,
        target: "release-toggle",
        focus: true,
        say: "Psst! This red bar means something new is out, past where you are. Open it for the dates.",
      },
    ],
  },
  {
    name: "New",
    lines: [
      {
        path: "/shelf",
        tab: "new",
        target: "shelf",
        say: "The New tab checks your whole shelf for new volumes and chapters. Already got one? Hide takes it off the list until something newer is out.",
      },
      {
        path: "/shelf",
        tab: "new",
        target: "upcoming",
        say: "Upcoming Releases is what's on its way for your shelf, and when. Open it for the month's dates, and to save them to your calendar.",
      },
    ],
  },
  {
    name: "Prices",
    lines: [
      {
        // (the page's address goes on to name the volume: anything under
        // this one book's counts)
        path: PRICE_PAGE,
        target: "offers",
        onTop: true,
        say: "Prices shows what a volume costs across stores, cheapest first, even if it isn't on your shelf. These prices are made up for the tour.",
      },
    ],
  },
  {
    name: "Last stop",
    lines: [
      {
        path: "/shelf",
        tab: "all",
        focus: true,
        say: "That's everything! Ready for a shelf of your own?",
        signedInSay: "That's everything! Your own shelf is waiting for you.",
      },
    ],
  },
];

export type TourStep = Line & { part: string };

export const TOUR_STEPS: TourStep[] = PARTS.flatMap(({ name, lines }) =>
  lines.map((line) => ({ ...line, part: name })),
);

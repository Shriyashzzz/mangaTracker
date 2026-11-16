import { cameFromTour, demoKind, practiceEdition } from "../../lib/demo";
import { shelfViewNow } from "../../lib/prefs";
import { seriesPath } from "../../lib/prices";

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
  // left out of the tour when it's already so for them, like compact rows
  // for someone whose shelf already shows them
  skip?: () => boolean;
  // only when this holds as they reach it, like the step for single volumes
  // after they've switched to them; passed over otherwise
  when?: () => boolean;
  // its words when it opens the tour: hello, or a welcome for someone who
  // came from the end of the other tour (and on phones, if they differ)
  opening?: {
    hello: string;
    welcome: string;
    phoneHello?: string;
    phoneWelcome?: string;
  };
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
  // ("phone": above it on phones only, where the screen is short)
  onTop?: boolean | "phone";
  // on a wide enough screen, beside the section's right edge instead
  besideIfRoom?: boolean;
  // a step on the shelf: which of its tabs it's on. The shelf opens on that
  // tab for it, and any other tab counts as having wandered off
  tab?: "all" | "new" | "volumes";
  // a folded section (<details>) he opens, so what he's talking about shows:
  // the target itself (true), or the section it's inside, by its name
  unfold?: true | string;
};

// the practice manga (lib/demo.ts): the one with a new volume, so the steps
// on a series' page are about it and only it
const MANGA = "/details/1";
// its newest volume's price page; the ISBN is vol. 15's (demo.ts FRIEREN_ISBNS)
const PRICE_PAGE = "/prices/9781974771240";
// a series added from its anime: the add page, with the title already in
// (demo.ts ANIME_SERIES answers for it)
const FROM_THE_ANIME = "/add?title=Jujutsu+Kaisen";

// The reader's tour: saving your place, what's new, and what it costs, and
// how the shelf and the prices meet. Everything else they find on their own
const READER: { name: string; lines: Line[] }[] = [
  {
    name: "My shelf",
    lines: [
      {
        path: "/shelf",
        tab: "all",
        target: "shelf",
        focus: true,
        onTop: true,
        say: "Hi, I'm Kenji! This is your shelf, a practice one, so wander off and explore any of it.",
      },
    ],
  },
  {
    name: "Adding a manga",
    lines: [
      {
        path: "/add",
        go: FROM_THE_ANIME,
        target: "anime",
        say: "Watched the anime? Tap the last season you saw: your chapter and volume fill in for you.",
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
        say: "Read a chapter? One tap here saves your place.",
        tap: true,
      },
      {
        path: MANGA,
        exact: true,
        target: "spines",
        tap: true,
        // on phones above the spines, where under them he'd cover "Tap a
        // book to mark it yours"; on laptops under them, which has room
        onTop: "phone",
        say: "Own the books too? Each spine is a volume: tap one to put it on your shelf.",
      },
      {
        path: MANGA,
        exact: true,
        target: "release-toggle",
        focus: true,
        say: "This red bar only shows once you're caught up and something new arrives.",
      },
      {
        path: MANGA,
        exact: true,
        target: "buy",
        // on phones Buy it is folded: he opens it
        unfold: true,
        say: "The volume you need next and its cheapest price: Vol. 15, $8.99. Your shelf and the prices work together.",
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
        say: "Vol. 15 of Frieren is out. New gathers what's come out for your whole shelf: the reason to come back.",
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
        target: "prices",
        onTop: true,
        say: 'Every store for Vol. 15: print copies cheapest first, then ebooks. Switch to Canada for Canadian stores, and tap "I own Vol. 15" once you\'ve bought it.',
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
        say: "That's the basics! Your shelf is free: bring your list from MyAnimeList, AniList or Kitsu in a minute.",
        signedInSay: "That's the basics! Your own shelf is waiting for you.",
      },
    ],
  },
];

// the collector's practice shelf (lib/demoCollector.json): Berserk, with its
// deluxe books, is series 2; Haikyu!!, missing vol. 31 and 32, series 5
const DELUXE = "/details/2";
const GAPS_SERIES = seriesPath("Haikyu!!");
const GAPS_EDIT = "/update/5";

// The collector's tour: a real collection of forty series, and everything a
// big shelf can do. Long on purpose: a collector wants to see it all. Told
// as a story, each series met before it's used: bringing it over, one
// series up close (Berserk), what's missing (Haikyu!!, start to finish), the
// whole shelf in numbers, what's coming, and getting it all back out
const COLLECTOR: { name: string; lines: Line[] }[] = [
  {
    name: "Your shelf",
    lines: [
      {
        path: "/shelf",
        tab: "all",
        target: "sort",
        skip: () => shelfViewNow() === "rows",
        say: 'Hundreds of series? Pick "Compact rows" here to fit far more on one screen.',
        opening: {
          hello:
            'Hi, I\'m Kenji! This practice shelf is a real collection of forty series. Pick "Compact rows" here to fit far more on one screen.',
          welcome:
            'Welcome to the collector\'s side! Forty real series here. Pick "Compact rows" here to fit far more on one screen.',
        },
      },
    ],
  },
  {
    name: "Bring it over",
    lines: [
      {
        path: "/shelf",
        target: "import-link",
        tab: "all",
        say: "Bring it all over: MyAnimeList, AniList, Kitsu, Goodreads, Book Catalogue or a spreadsheet. Deluxe and 3-in-1 editions are understood.",
        phoneSay:
          "Bring it all over with Import your list, here in the menu: MyAnimeList, AniList, Kitsu, Goodreads, Book Catalogue or a spreadsheet.",
        opening: {
          hello:
            "Hi, I'm Kenji! This practice shelf is a real collection of forty series. Yours comes over in one go from MyAnimeList, AniList, Kitsu, Goodreads, Book Catalogue or a spreadsheet.",
          welcome:
            "Welcome to the collector's side! Forty real series here, and yours comes over in one go from MyAnimeList, AniList, Kitsu, Goodreads, Book Catalogue or a spreadsheet.",
          phoneHello:
            "Hi, I'm Kenji! This practice shelf is a real collection of forty series. Import your list, here in the menu, brings yours over in one go.",
          phoneWelcome:
            "Welcome to the collector's side! Forty real series here. Import your list, here in the menu, brings yours over in one go.",
        },
        inMenuOnPhone: true,
      },
      {
        path: "/shelf",
        tab: "all",
        target: "scan",
        say: "New haul? Scan the barcodes on the spines, one after another.",
        phoneSay:
          "New haul? The + button scans the barcodes on the spines, one after another.",
      },
    ],
  },
  {
    name: "Berserk up close",
    lines: [
      {
        path: DELUXE,
        exact: true,
        // the whole of Your books, opened
        target: "your-books",
        unfold: true,
        // always above the books, never over the ones below
        onTop: true,
        say: "Let's open one: Berserk, collected in Deluxe. Every book you own is here, with what you paid. We add it all up for you.",
      },
      {
        path: DELUXE,
        exact: true,
        target: "edition",
        // inside Buy it, folded on phones: opened first
        unfold: "buy",
        say: "Collect a different edition? Pick it here: Single, Deluxe, or whatever the series comes in.",
      },
      {
        path: DELUXE,
        exact: true,
        target: "spines",
        when: () => practiceEdition(2) === "singles",
        say: "Collecting single volumes now: tap a spine to mark it yours, then put what you paid in Your books.",
      },
    ],
  },
  {
    name: "What's missing",
    lines: [
      {
        path: "/shelf",
        tab: "volumes",
        target: "gaps",
        tap: true,
        opensNext: true,
        say: "Now the gaps across your shelf. Every series says which volumes you own and how many you're missing. Haikyu!! is missing two: open it.",
      },
      {
        path: "/shelf",
        tab: "volumes",
        target: "gaps-open",
        needsLastStep: true,
        say: "Vol. 31 and 32 are the faded ones. Tap one to see what it costs.",
      },
      {
        path: "/prices/series/",
        go: GAPS_SERIES,
        target: "series-cost",
        onTop: true,
        say: "This is Haikyu!!'s page in Prices. You're missing 2 volumes, and finishing the series costs $17.98. Tap \"Not on your shelf\" to see only those two.",
      },
      {
        path: GAPS_EDIT,
        exact: true,
        target: "volume-picker",
        // above the spines, never over them
        onTop: true,
        say: 'This is Edit details. Tap Vol. 31 and 32 once you have them. A volume not listed? "Show vols." below adds more.',
      },
    ],
  },
  {
    name: "Your whole shelf",
    lines: [
      {
        path: "/shelf",
        tab: "volumes",
        target: "worth",
        unfold: true,
        say: "Add it all up: what you've spent, what your shelf is worth, and what finishing every series would cost.",
      },
    ],
  },
  {
    name: "What's coming",
    lines: [
      {
        path: "/shelf",
        tab: "new",
        // the New tab itself: at the top on laptops, in the bottom bar on
        // phones
        target: "tab-new",
        say: "New lists the next volume out for every series you collect.",
      },
      {
        path: "/shelf",
        tab: "new",
        target: "upcoming",
        say: "Tap Upcoming Releases: what's coming for your shelf, and when. Preorder from here, or save the dates to your calendar.",
      },
    ],
  },
  {
    name: "Yours to keep",
    lines: [
      {
        path: "/settings/account",
        exact: true,
        target: "export",
        lookOnly: true,
        say: "Keeping your spreadsheet too? Download your whole shelf as one, any time.",
      },
      {
        path: "/settings/profile",
        exact: true,
        target: "share",
        // above it: turning sharing on grows the section downward, and he
        // stays where he is
        onTop: true,
        say: "Proud of it? Turn on a share link and show your shelf off.",
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
        say: "That's the collector's tour! Ready to bring yours over?",
        signedInSay: "That's the collector's tour! Your own shelf is waiting.",
      },
    ],
  },
];

export type TourStep = Line & { part: string };

const stepsOf = (parts: { name: string; lines: Line[] }[]): TourStep[] =>
  parts.flatMap(({ name, lines }) =>
    lines.map((line) => ({ ...line, part: name })),
  );

// the collector's steps for this visitor: any already so for them left out,
// and whichever comes first opens with its own hello, or a welcome for
// someone who came from the end of the reader's tour
function collectorSteps(): TourStep[] {
  const [first, ...rest] = stepsOf(COLLECTOR).filter((step) => !step.skip?.());
  const opening = first!.opening;
  if (!opening) return [first!, ...rest];
  const welcomed = cameFromTour();
  return [
    {
      ...first!,
      say: welcomed ? opening.welcome : opening.hello,
      phoneSay: welcomed ? opening.phoneWelcome : opening.phoneHello,
    },
    ...rest,
  ];
}

// the tour this page load is on: starting either reloads the page
export const TOUR_STEPS: TourStep[] =
  demoKind() === "collector" ? collectorSteps() : stepsOf(READER);

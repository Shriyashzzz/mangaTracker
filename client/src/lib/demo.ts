// The guided tour's pretend account. While it's on, apiFetch answers from here, so
// every real page works on a practice shelf and nothing reaches the server: no real
// data can change and no paid price search can run. It lives in this tab and goes
// when the tour ends.
import { spentOn, type OwnedBook } from "./books";
import { ownedOf, ownedVolumes } from "./ownedVolumes";
import type { MalEntry } from "./imports/malImport";
import type { Manga } from "./types";
import type { CalendarMonth, ShelfTools } from "./collector";
import {
  collectorBooks,
  collectorShelf,
  collectorVolume,
  loadCollector,
  type CollectorSeries,
} from "./demoCollector";

const ON_KEY = "demoTour";
const SHELF_KEY = "demoShelf";
const ACCOUNT_KEY = "demoAccount";
const PREFS_KEY = "demoPrefs";
const KIND_KEY = "demoKind";
const START_MARK = "beforeTour";
const TOUR_START = "/shelf";
const COVER = "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large";

export const isDemo = () => {
  try {
    return sessionStorage.getItem(ON_KEY) === "on";
  } catch {
    return false;
  }
};

// Two tours: the reader's, short, on a small shelf; and the collector's, on
// a real collection of forty series (lib/demoCollector.ts)
export type DemoKind = "reader" | "collector";
export const demoKind = (): DemoKind => {
  try {
    return sessionStorage.getItem(KIND_KEY) === "collector"
      ? "collector"
      : "reader";
  } catch {
    return "reader";
  }
};

// the practice manga's newest volume: the one that's "out" on the red bar
// and the New tab, and whose price page the tour opens
// (tour/steps.ts PRICE_PAGE)
export const NEW_VOLUME = 15;
const PRACTICE_SLUG = "frieren-beyond-journey-s-end";
// its volumes' real ISBNs, so their real covers show
const FRIEREN_ISBNS = [
  "9781974725762",
  "9781974731213",
  "9781974731633",
  "9781974732883",
  "9781974733446",
  "9781974734009",
  "9781974737383",
  "9781974738601",
  "9781974742035",
  "9781974744763",
  "9781974750207",
  "9781974753567",
  "9781974752911",
  "9781974764068",
  "9781974771240",
];

const practice = (
  id: number,
  name: string,
  genre: string,
  cover: string,
  rest: Partial<Manga> = {},
): Manga => ({
  id,
  userId: 0,
  name,
  genre,
  image: `${COVER}/${cover}`,
  description: null,
  status: false,
  planned: false,
  lightNovel: false,
  bookmark: 1,
  volumesOwned: null,
  rating: null,
  ...rest,
});

const STARTING_SHELF: Manga[] = [
  // The practice manga (id 1): the one with a new volume out, which the
  // tour's steps on a series' page use. Its numbers are the real series'
  // as of late 2026 (15 volumes in English), so nothing here misleads; and
  // it's short enough that its shelf of books can be tried on a phone
  practice(
    1,
    "Frieren: Beyond Journey's End",
    "Adventure",
    "bx118586-CXKgWikBFQgS.jpg",
    {
      // in vol. 14 (chapters 128 to 137), the last one they own: certain
      // from the list of where each volume starts, so the page says so
      bookmark: 135,
      volumesOwned: NEW_VOLUME - 1,
      rating: 5,
    },
  ),
  // a chapter reader: no volumes, so nothing is said about how many are out
  practice(2, "One Piece", "Action", "bx30013-BeslEMqiPhlk.jpg", {
    bookmark: 1100,
  }),
  practice(3, "Chainsaw Man", "Action", "bx105778-euxXZEIfDY2u.png", {
    bookmark: 120,
  }),
  practice(4, "SPY x FAMILY", "Action", "bx108556-NHjkz0BNJhLx.jpg", {
    bookmark: 72,
    rating: 4,
  }),
  practice(5, "Witch Hat Atelier", "Adventure", "bx98263-kIeaTXrAbGkj.jpg", {
    bookmark: 60,
  }),
  practice(6, "Fullmetal Alchemist", "Action", "bx30025-mpPVpCKFTowt.png", {
    status: true,
    bookmark: null,
    rating: 5,
  }),
];

// the shelf tools for a practice shelf: each owned volume worth $6.50 used,
// and every volume between 1 and the newest known that isn't theirs still to
// get, at made-up prices from two stores.
// `known` is a series' volumes in English by number, with their ISBNs
const PRACTICE_STORES = ["Books-A-Million", "eBay"];
function practiceShelfTools(
  shelf: Manga[],
  known: (m: Manga) => Map<number, string>,
  paid: { cents: number; books: number },
): ShelfTools {
  const owners = shelf.filter((m) => ownedOf(m).length);
  const finish = owners.flatMap((m) => {
    const owned = new Set(ownedOf(m));
    const listed = known(m);
    const newest = Math.max(0, ...listed.keys());
    const missing = Array.from({ length: newest }, (_, i) => i + 1)
      .filter((volume) => !owned.has(volume))
      .map((volume) => ({
        volume,
        isbn13: listed.get(volume) ?? "",
        title: `${m.name}, Vol. ${volume}`,
        cheapest: {
          cents: 899 + (volume % 3) * 50,
          store: PRACTICE_STORES[volume % 2]!,
          url: null,
        },
      }));
    if (!missing.length) return [];
    const cents = missing.reduce((sum, v) => sum + v.cheapest.cents, 0);
    return [
      {
        mangaId: m.id,
        name: m.name,
        missing,
        cents,
        priced: missing.length,
        estimateCents: cents,
      },
    ];
  });
  const owned = owners.reduce((sum, m) => sum + ownedOf(m).length, 0);
  return {
    spent: paid,
    value: {
      cents: owned * 650,
      priced: owned,
      volumes: owned,
      unlisted: 0,
      estimateCents: owned * 650,
    },
    finish,
    finishCents: finish.reduce((sum, f) => sum + f.cents, 0),
    finishPriced: finish.reduce((sum, f) => sum + f.priced, 0),
    finishMissing: finish.reduce((sum, f) => sum + f.missing.length, 0),
    finishEstimateCents: finish.reduce((sum, f) => sum + f.estimateCents, 0),
  };
}

// volumes coming out over the next few months: for each of a few series
// with a known English list, the one after its newest. Their days are made
// up, as the tour's prices are
function practiceCalendar(
  shelf: Manga[],
  known: (m: Manga) => [number, string][],
): CalendarMonth[] {
  const listed = shelf.filter((m) => known(m).length).slice(0, 4);
  return listed.map((m, i) => {
    const day = new Date();
    day.setUTCMonth(day.getUTCMonth() + i + 1, 12);
    const published = day.toISOString().slice(0, 10);
    const list = known(m);
    const volume = list[list.length - 1]![0] + 1;
    return {
      month: published.slice(0, 7),
      volumes: [
        {
          volume,
          // made up, 13 digits, never a real book's
          isbn13: `9780009${String(m.id).padStart(3, "0")}${String(volume).padStart(3, "0")}`,
          title: `${m.name}, Vol. ${volume}`,
          coverUrl: m.image,
          published,
          month: published.slice(0, 7),
          mangaId: m.id,
          name: m.name,
          seriesCover: m.image,
          owned: false,
        },
      ],
    };
  });
}

const readShelf = (starting: Manga[]): Manga[] => {
  try {
    const saved = sessionStorage.getItem(SHELF_KEY);
    if (saved) return JSON.parse(saved) as Manga[];
  } catch {
    /* start over */
  }
  return starting;
};
const writeShelf = (shelf: Manga[]) => {
  try {
    sessionStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
  } catch {
    /* it just won't survive a refresh */
  }
};

// a full reload, so nothing from a guest's visit or the tour leaks into the other
// inside the tour the practice account answers as signed in, so whether the real
// person was is noted as it starts
const WAS_SIGNED_IN_KEY = "demoWasSignedIn";
// which edition they collect a practice series in, as they've set it on the
// tour (the tour's step on single volumes follows it)
export const practiceEdition = (id: number) => {
  try {
    const shelf = JSON.parse(
      sessionStorage.getItem(SHELF_KEY) ?? "[]",
    ) as Manga[];
    return shelf.find((m) => m.id === id)?.edition ?? null;
  } catch {
    return null;
  }
};

export const wasSignedInBeforeTour = () => {
  try {
    return sessionStorage.getItem(WAS_SIGNED_IN_KEY) === "yes";
  } catch {
    return false;
  }
};

// `fromTour`: started from the end of the other tour, so Kenji says welcome
// rather than hello again
const FROM_TOUR_KEY = "demoFromTour";
export const cameFromTour = () => {
  try {
    return sessionStorage.getItem(FROM_TOUR_KEY) === "yes";
  } catch {
    return false;
  }
};

export function startDemo(
  wasSignedIn = false,
  kind: DemoKind = "reader",
  fromTour = false,
) {
  try {
    // marks this page, so going back to it leaves the tour
    history.replaceState({ ...history.state, [START_MARK]: true }, "");
    // opening the address already showing replaces it, so the tour needs its own
    if (window.location.pathname === TOUR_START) {
      history.pushState(null, "", TOUR_START);
    }
    // nothing from a guest's visit comes along
    sessionStorage.clear();
    sessionStorage.setItem(ON_KEY, "on");
    sessionStorage.setItem(KIND_KEY, kind);
    if (fromTour) sessionStorage.setItem(FROM_TOUR_KEY, "yes");
    sessionStorage.setItem("libraryStatus", "all");
    // the tour shows US prices, whatever this browser had picked
    sessionStorage.setItem("demoLocal:country", "us");
    if (wasSignedIn) sessionStorage.setItem(WAS_SIGNED_IN_KEY, "yes");
  } catch {
    return;
  }
  window.location.assign(TOUR_START);
}

// everything the tour keeps is in this tab's sessionStorage: practice shelf, settings,
// remembered pages and filters. So leaving takes it all, and nothing carries over
function clearDemo() {
  try {
    sessionStorage.clear();
  } catch {
    /* nothing to tidy */
  }
}

export function endDemo(to = "/") {
  clearDemo();
  window.location.assign(to);
}

// the browser's back button from the tour's first page lands where they clicked Take
// the tour, so that's them leaving. Only that page: the Prices steps also use "/".
const backAtStart = () =>
  isDemo() &&
  Boolean((history.state as Record<string, unknown> | null)?.[START_MARK]);

if (typeof window !== "undefined") {
  // back to a new page load, or one the browser kept in memory: that page never ran
  // the tour, so tidying up is enough
  const tidy = () => {
    if (backAtStart()) clearDemo();
  };
  tidy();
  window.addEventListener("pageshow", tidy);
  // back within this page load: the tour is on screen, so start clean
  window.addEventListener("popstate", () => {
    if (!backAtStart()) return;
    clearDemo();
    window.location.reload();
  });
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

// The practice manga has a new volume out, Chainsaw Man a new chapter, and the rest are
// caught up, so the red bar and the New tab have something real to show
// On the collector's shelf, a series whose English list goes past the last
// volume they own has its next one out, as the real New tab would say
function collectorReleases(m: Manga, known: [number, string][]) {
  const newestOwned = Math.max(0, ...ownedOf(m));
  const out = known.filter(([volume]) => volume > newestOwned);
  const newest = known.length ? known[known.length - 1]![0] : null;
  const next = out[0];
  const book = ([volume, isbn13]: [number, string]) => ({
    volume,
    isbn13,
    title: `${m.name}, Vol. ${volume}`,
  });
  return {
    releaseData: null,
    releaseStatus: {
      hasNewVolume: Boolean(next) && (m.seenVolume ?? 0) < next![0],
      hasNewChapter: false,
      hasNewJapaneseVolume: false,
      // listed only with something out: listed and not new reads as hidden
      volumeListed: Boolean(next),
      chapterListed: false,
      japanListed: false,
      isNextVolumeOut: Boolean(next),
      currentVolume: newestOwned || null,
      latestVolume: newest,
      nextChapter: m.bookmark == null ? null : m.bookmark + 1,
      nextVolume: next ? next[0] : null,
      nextVolumeBook: next ? book(next) : null,
      outVolumes: out.map(book),
      outJapanVolumes: [],
      // no real count of chapters out: none, so a row says "ch. 20" and
      // never a made-up "ch. 20 of 20", as a real shelf does without one
      latestChapter: null,
      latestJapaneseVolume: null,
    },
    complete: true,
  };
}

// where each of Frieren's volumes starts, by chapter, as the site has it
// (MangaDex, saved in release_dates)
const FRIEREN_VOLUME_STARTS = [
  1, 8, 18, 28, 38, 48, 58, 68, 78, 88, 98, 108, 118, 128, 138,
].map((firstChapter, i) => ({ volume: i + 1, firstChapter }));

function releasesFor(m: Manga, kind: DemoKind) {
  const reader = kind === "reader";
  const volumeOut = reader && m.id === 1 && (m.seenVolume ?? 0) < NEW_VOLUME;
  const chapterOut = reader && m.id === 3 && (m.seenChapter ?? 0) < 123;
  const nextVolume = reader && m.id === 1 ? NEW_VOLUME : null;
  // Chainsaw Man's is known; the rest have no count, as in collectorReleases
  const latestChapter = reader && m.id === 3 ? 123 : null;
  return {
    releaseData:
      reader && m.id === 1
        ? {
            volume: [{ volume: String(NEW_VOLUME), releaseDate: days(-40) }],
            volumeStarts: FRIEREN_VOLUME_STARTS,
            newVolume: {
              volume: String(NEW_VOLUME + 1),
              releaseDate: days(60),
              isEstimate: true,
            },
          }
        : reader && m.id === 3
          ? {
              chapter: {
                latestReleased: { chapterNumber: "123", releaseDate: days(-4) },
                estimateRelease: {
                  chapterNumber: "124",
                  releaseDate: days(6),
                  isEstimate: true,
                },
              },
            }
          : null,
    releaseStatus: {
      hasNewVolume: volumeOut,
      hasNewChapter: chapterOut,
      hasNewJapaneseVolume: false,
      volumeListed: nextVolume != null,
      chapterListed: chapterOut || (reader && m.id === 3),
      japanListed: false,
      isNextVolumeOut: nextVolume != null,
      currentVolume: m.volumesOwned,
      latestVolume: nextVolume,
      nextChapter: m.bookmark == null ? null : m.bookmark + 1,
      nextVolume,
      nextVolumeBook: nextVolume
        ? { isbn13: isbnOf(nextVolume), title: `${m.name}, Vol. ${nextVolume}` }
        : null,
      outVolumes: nextVolume
        ? [
            {
              volume: nextVolume,
              isbn13: isbnOf(nextVolume),
              title: `${m.name}, Vol. ${nextVolume}`,
            },
          ]
        : [],
      outJapanVolumes: [],
      latestChapter,
      latestJapaneseVolume: null,
    },
    complete: true,
  };
}

const isbnOf = (volume: number) => FRIEREN_ISBNS[volume - 1]!;
const coverOf = (isbn: string) => `/api/prices/cover/${isbn}`;

// a series' volumes as the price checker lists them, from [volume, ISBN]
const seriesVolumes = (name: string, volumes: [number, string][]) =>
  volumes.map(([volume, isbn13]) => ({
    isbn13,
    title: `${name}, Vol. ${volume}`,
    volume,
    coverUrl: coverOf(isbn13),
    knownPriceCents: 899,
  }));
const FRIEREN_VOLUMES = FRIEREN_ISBNS.map(
  (isbn, i) => [i + 1, isbn] as [number, string],
);

const sampleOffer = (
  store: string,
  condition: string,
  priceCents: number,
  format = "print",
) => ({
  store,
  format,
  condition,
  priceCents,
  currency: "USD",
  inStock: true,
  // made-up prices shouldn't link to a real store
  url: null,
  affiliate: false,
  fetchedAt: days(-1),
});

// what a save changes on a practice series: `part` is the end of the
// address ("/api/manga/3/rating" is "rating"), `body` what was sent with it
function changesFor(
  part: string | undefined,
  body: Record<string, unknown>,
): Partial<Manga> {
  if (part === "bookmark") return { bookmark: body.bookmark as number };
  if (part === "reading") return body as Partial<Manga>;
  if (part === "rating") return { rating: body.rating as number };
  if (part === "notes")
    return { description: body.description as string | null };
  if (part === "status")
    return { status: body.status as boolean, planned: false };
  if (part === "planned") {
    // onto the To read list, or off it and reading from chapter 1
    return body.planned
      ? { planned: true, status: false }
      : { planned: false, bookmark: 1 };
  }
  if (part === "seen") {
    const field = body.kind === "chapter" ? "seenChapter" : "seenVolume";
    return { [field]: body.number as number | null };
  }
  return {};
}

function volumePage(
  isbn: string,
  shelf: Manga[],
  collector: CollectorSeries[] | null,
) {
  // a volume of the collector's shelf, or else the practice manga's,
  // wherever it is on the shelf and even if they've deleted it
  const found = collector && collectorVolume(collector, isbn);
  const manga = found
    ? null
    : (shelf.find((m) => m.id === 1) ?? STARTING_SHELF[0]!);
  const name = found ? found.series.name : manga!.name;
  const volume = found
    ? found.volume
    : FRIEREN_ISBNS.indexOf(isbn) + 1 || NEW_VOLUME;
  const series = found
    ? { name, slug: "practice", info: null }
    : { name, slug: PRACTICE_SLUG, info: null };
  return {
    series,
    volume,
    siblings: seriesVolumes(
      name,
      found ? found.series.volumes : FRIEREN_VOLUMES,
    ),
    book: {
      isbn13: isbn,
      title: `${name}, Vol. ${volume}`,
      authors: found ? null : "Kanehito Yamada, Tsukasa Abe",
      publisher: found ? null : "VIZ Media",
      coverUrl: coverOf(isbn),
      year: found ? null : 2024,
    },
    offers: [
      sampleOffer("ThriftBooks", "used", 599),
      sampleOffer("eBay", "marketplace", 650),
      sampleOffer("Kindle", "new", 599, "ebook"),
      sampleOffer("Amazon", "new", 899),
      sampleOffer("Barnes & Noble", "new", 949),
    ],
    history: null,
    checkedAt: days(-1),
    liveSources: ["Google Shopping"],
    storeLinks: [],
  };
}

// where each season of Jujutsu Kaisen's anime leaves off in the manga,
// copied from the site's own answer (MangaUpdates, November 2026)
export const ANIME_SERIES = {
  name: "Jujutsu Kaisen",
  slug: "jujutsu-kaisen",
  coverUrl:
    "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx101517-H3TdM3g5ZUe9.jpg",
  stops: [
    {
      label: "Season 1",
      endVolume: 8,
      endChapter: 63,
      nextChapter: 64,
      nextVolume: 8,
    },
    {
      label: "Season 2",
      endVolume: 16,
      endChapter: 137,
      nextChapter: 138,
      nextVolume: 16,
    },
    {
      label: "Season 3",
      endVolume: 21,
      endChapter: 181,
      endsMidChapter: true,
      nextChapter: 181,
      nextVolume: null,
    },
  ].map((stop) => ({
    endsMidChapter: false,
    note: "",
    corrected: false,
    coversAll: false,
    ...stop,
  })),
  sourceUrl: "https://www.mangaupdates.com/series/axmopy6/jujutsu-kaisen",
  checkedAt: "2026-11-15T19:21:46.224Z",
};

const readSaved = <T>(key: string, fallback: T): T => {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;
  } catch {
    /* start over */
  }
  return fallback;
};
const save = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* it just won't survive a refresh */
  }
};

// what they type into the practice shelf's books (a price paid, the day
// bought) and the volumes they rate: kept in this tab, like the shelf
const PAID_KEY = "demoPaid";
// books they've added by hand ("Add a book you own", "I own Deluxe 7"), by
// series id
const ADDED_KEY = "demoAddedBooks";
// books they've removed, by id
const REMOVED_KEY = "demoRemovedBooks";
// series deleted from the practice shelf, by name, as they were: the undo
// puts each back with its own id (the undo sends no ids), so its covers and
// books come back with it
const DELETED_KEY = "demoDeleted";
const REVIEWS_KEY = "demoReviews";
type Purchase = { paidCents?: number | null; boughtOn?: string | null };
type SavedReview = {
  id: number;
  rating: number;
  text: string;
  spoiler: boolean;
  writtenAt: string;
};

// a series' books with what they've typed in over the file's
// a day in the two years before November 2026, the same each time
const boughtDay = (seed: number) => {
  const day = new Date(Date.UTC(2024, 10, 1));
  day.setUTCDate(day.getUTCDate() + ((seed * 37) % 720));
  return day.toISOString().slice(0, 10);
};

// A series' books on the collector's shelf, every one with what was paid
// and when: its deluxe and omnibus books from the file, and each other
// volume they own as a single, at a made-up price. Then what they've typed
// in over those
const booksOf = (series: CollectorSeries | undefined, manga: Manga) => {
  if (!series) return [];
  const typed = readSaved<Record<string, Purchase>>(PAID_KEY, {});
  const fromFile = collectorBooks(series);
  const inBooks = new Set(fromFile.flatMap((b) => b.volumes));
  const singles = ownedOf(manga)
    .filter((volume) => Number.isInteger(volume) && !inBooks.has(volume))
    .map((volume) => ({
      // after the file's books, so they never share an id
      id: series.id * 1000 + 500 + volume,
      edition: "single" as const,
      number: volume,
      title: null,
      isbn13: series.volumes.find(([v]) => v === volume)?.[1] ?? null,
      volumes: [volume],
      paidCents: 799 + ((series.id * 7 + volume) % 5) * 100,
      boughtOn: boughtDay(series.id * 100 + volume),
    }));
  const added = (
    readSaved<Record<string, Omit<OwnedBook, "id">[]>>(ADDED_KEY, {})[
      String(series.id)
    ] ?? []
  ).map((b, i) => ({ ...b, id: series.id * 1000 + 900 + i }));
  const removed = new Set(readSaved<number[]>(REMOVED_KEY, []));
  // as the server: a book whose volumes aren't all owned any more is gone
  const owned = new Set(ownedOf(manga));
  return [
    ...fromFile,
    ...added,
    ...singles.filter(
      (single) => !added.some((b) => b.volumes.includes(single.number!)),
    ),
  ]
    .filter((b) => !removed.has(b.id) && b.volumes.every((v) => owned.has(v)))
    .map((b) => ({
      ...b,
      ...typed[String(b.id)],
    }));
};

const STARTING_ACCOUNT = {
  username: "practice",
  displayName: null as string | null,
  avatar: "kenji" as string | null,
  recoveryEmail: null,
  shareEnabled: false,
  shareNotes: false,
  shareCode: "practice" as string | null,
  weeklyEmail: false,
  emailConfirmed: false,
  defaultName: "Chapter Goblin",
  nameIdeas: ["Chapter Goblin", "Volume Hoarder", "Panel Hopper"],
};

const readAccount = () => readSaved(ACCOUNT_KEY, STARTING_ACCOUNT);

const sameTitle = (a: unknown, b: unknown) =>
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
// as the server: adding can put the manga and the light novel of a series side
// by side, an import counts the name in either format
const hasTitle = (shelf: Manga[], title: unknown, lightNovel?: boolean) =>
  shelf.some(
    (m) =>
      sameTitle(m.name, title) &&
      (lightNovel === undefined || Boolean(m.lightNovel) === lightNovel),
  );
const TITLE_TAKEN = () =>
  json({ error: [{ msg: "That title is already on your shelf" }] }, 409);
const nextId = (shelf: Manga[]) => Math.max(0, ...shelf.map((m) => m.id)) + 1;

// the add and edit forms send the same fields, numbers as text
const fromForm = (body: Record<string, unknown>) => ({
  name: String(body.name),
  genre: String(body.genre ?? ""),
  image: (body.image as string) || null,
  description: (body.description as string) || null,
  status: Boolean(body.status) && !body.planned,
  planned: Boolean(body.planned),
  lightNovel: Boolean(body.lightNovel),
  bookmark: Number(body.bookmark) || null,
  ...ownedVolumes(
    Number(body.volumesOwned) || null,
    Array.isArray(body.ownedList) ? (body.ownedList as number[]) : [],
  ),
});

// what the app's own server would say, for what the tour can reach. Anything else
// is a plain "not found": it must never go looking on the real server
export async function demoResponse(
  path: string,
  method = "GET",
  rawBody?: string,
): Promise<Response> {
  const url = new URL(path, "https://demo.invalid");
  const route = url.pathname;
  const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  const kind = demoKind();
  const collector = kind === "collector" ? await loadCollector() : null;
  const shelf = readShelf(
    collector ? collectorShelf(collector) : STARTING_SHELF,
  );
  // a series' volumes in English, by number: the collector's from its list,
  // the practice manga's, and none for the rest
  const seriesOf = (m: Manga) =>
    collector?.find((s) => s.id === m.id && s.name === m.name);
  const knownOf = (m: Manga): [number, string][] => {
    if (collector) return seriesOf(m)?.volumes ?? [];
    return m.id === 1 ? FRIEREN_VOLUMES : [];
  };

  if (route === "/api/auth/me") return json({ id: 0, username: "practice" });
  // the real ways out of an account end the practice one
  if (
    route === "/api/auth/logout" ||
    (route === "/api/account" && method === "DELETE")
  ) {
    endDemo();
    return json({ ok: true });
  }
  if (route === "/api/prefs") {
    const prefs = {
      ...readSaved(PREFS_KEY, {}),
      ...(method === "PUT" ? body : {}),
    };
    save(PREFS_KEY, prefs);
    return json(prefs);
  }
  if (route === "/api/manga" && method === "GET") return json({ manga: shelf });
  if (route === "/api/manga" && method === "POST") {
    if (hasTitle(shelf, body.name, Boolean(body.lightNovel)))
      return TITLE_TAKEN();
    const id = nextId(shelf);
    writeShelf([...shelf, { ...practice(id, "", "", ""), ...fromForm(body) }]);
    return json({ id }, 201);
  }
  // ---------- deleting and its undo, one or many (shelf Select) ----------
  const forget = (gone: Manga[]) =>
    save(DELETED_KEY, {
      ...readSaved<Record<string, Manga>>(DELETED_KEY, {}),
      ...Object.fromEntries(gone.map((m) => [m.name, m])),
    });
  // a series sent back by the undo: the one that went, as it was, or a new
  // one from what was sent. Null when it's on the shelf already
  const restore = (sent: Partial<Manga>, onShelf: Manga[]) => {
    if (hasTitle(onShelf, sent.name, Boolean(sent.lightNovel))) return null;
    const was = readSaved<Record<string, Manga>>(DELETED_KEY, {})[
      String(sent.name)
    ];
    if (was && !onShelf.some((m) => m.id === was.id)) return was;
    const id = nextId(onShelf);
    return { ...practice(id, "", "", ""), ...sent, id } as Manga;
  };
  if (route === "/api/manga/restore") {
    const back = restore(body as Partial<Manga>, shelf);
    if (!back) return json({ ok: true }, 409);
    writeShelf([...shelf, back]);
    return json({ ok: true });
  }
  if (route === "/api/manga/restore-many") {
    let now = shelf;
    let restored = 0;
    for (const sent of body.manga as Partial<Manga>[]) {
      const back = restore(sent, now);
      if (!back) continue;
      now = [...now, back];
      restored++;
    }
    writeShelf(now);
    return json({ restored, invalid: 0 });
  }
  if (route === "/api/manga/delete-many") {
    const ids = new Set(body.ids as number[]);
    const gone = shelf.filter((m) => ids.has(m.id));
    forget(gone);
    writeShelf(shelf.filter((m) => !ids.has(m.id)));
    return json({ manga: gone });
  }
  // Select's "Move to": as the server does it, Reading puts one that hadn't
  // started at chapter 1. What each was comes back, for the undo
  if (route === "/api/manga/move-many") {
    const ids = new Set(body.ids as number[]);
    const to = body.to as "reading" | "finished" | "planned";
    const was = shelf
      .filter((m) => ids.has(m.id))
      .map(({ id, status, planned, bookmark }) => ({
        id,
        status,
        planned,
        bookmark,
      }));
    writeShelf(
      shelf.map((m) =>
        !ids.has(m.id)
          ? m
          : to === "finished"
            ? { ...m, status: true, planned: false }
            : to === "planned"
              ? { ...m, planned: true, status: false }
              : {
                  ...m,
                  status: false,
                  planned: false,
                  bookmark: m.planned && m.bookmark == null ? 1 : m.bookmark,
                },
      ),
    );
    return json({ was });
  }
  // the move's undo: each one's place put back
  if (route === "/api/manga/place-many") {
    const places = new Map(
      (
        body.places as Pick<Manga, "id" | "status" | "planned" | "bookmark">[]
      ).map((p) => [p.id, p]),
    );
    writeShelf(shelf.map((m) => ({ ...m, ...places.get(m.id) })));
    return json({ ok: true });
  }
  // every book on the practice shelf, for the export (Settings, Account)
  if (route === "/api/manga/books")
    return json({
      books: shelf.flatMap((m) =>
        booksOf(seriesOf(m), m).map((b) => ({ ...b, mangaId: m.id })),
      ),
    });
  if (route === "/api/manga/import") {
    const entries = body.entries as MalEntry[];
    const added = entries.filter((entry) => !hasTitle(shelf, entry.title));
    const firstId = nextId(shelf);
    writeShelf([
      ...shelf,
      ...added.map((entry, i) => ({
        ...practice(firstId + i, entry.title, "", ""),
        image: entry.cover ?? null,
        status: entry.finished && !entry.planned,
        planned: Boolean(entry.planned),
        lightNovel: Boolean(entry.lightNovel),
        bookmark: entry.chapters || null,
        // as the server does: volumes read when they haven't said what they
        // own, or exactly which, when a book app's file says
        ...ownedVolumes(
          entry.ownedVolumes || entry.readVolumes || null,
          entry.ownedList,
        ),
        rating: entry.score ? Math.ceil(entry.score / 2) : null,
        description: entry.comments || null,
      })),
    ]);
    return json({
      added: added.length,
      alreadyThere: entries.length - added.length,
      noCover: added.length,
    });
  }
  // is this series on the practice shelf? (the price page's "I own Vol. 15")
  if (route === "/api/manga/match") {
    const series = url.searchParams.get("series");
    const manga = shelf.find((m) => !m.lightNovel && sameTitle(m.name, series));
    return json(manga ?? null);
  }
  // a series' omnibus and deluxe lines: the collector's, from its file, at
  // made-up prices
  if (route === "/api/prices/editions") {
    const series = collector?.find(
      (s) => s.name === url.searchParams.get("name"),
    );
    return json({
      lines: (series?.editions ?? []).map((line) => ({
        ...line,
        books: line.books.map((b) => ({
          ...b,
          knownPriceCents: line.kind === "deluxe" ? 3999 : 1499,
        })),
      })),
    });
  }
  // the reader's tour adds a series from its anime: the real answer, as
  // MangaUpdates gave it
  if (route === "/api/after-anime") {
    return url.searchParams.get("name") === ANIME_SERIES.name
      ? json(ANIME_SERIES)
      : json({ error: [{ msg: "Not found" }] }, 404);
  }
  // the practice account has no inbox to send to
  if (route === "/api/account/weekly-email")
    return json(
      { error: [{ msg: "The practice account can't get emails." }] },
      400,
    );
  if (route === "/api/account") {
    const account = { ...readAccount(), ...(method === "PATCH" ? body : {}) };
    save(ACCOUNT_KEY, account);
    return json(account);
  }
  if (route.startsWith("/api/share/")) {
    const account = readAccount();
    return json({
      displayName: account.displayName ?? account.defaultName,
      avatar: account.avatar,
      manga: shelf.map(
        ({
          name,
          image,
          genre,
          status,
          planned,
          bookmark,
          rating,
          description,
        }) => ({
          name,
          image,
          genre,
          status,
          planned,
          bookmark,
          rating,
          ...(account.shareNotes && description ? { notes: description } : {}),
        }),
      ),
    });
  }
  if (route === "/api/prices/series") {
    const name = url.searchParams.get("name") ?? "";
    // as an address spells it too: "one piece" is One Piece
    const loose = (text: string) =>
      text.toLowerCase().replace(/[^a-z0-9]/g, "");
    const manga = shelf.find((m) => loose(m.name) === loose(name));
    const known = manga ? knownOf(manga) : [];
    // a series the practice shelf has no volumes for: the real public answer,
    // as any visitor gets it (nothing of the account goes with it), never
    // "no English volumes"
    if (!known.length)
      return fetch(`${import.meta.env.VITE_API_URL ?? ""}${path}`);
    return json({
      name: manga!.name,
      slug: "practice",
      info: null,
      incomplete: false,
      volumes: seriesVolumes(manga!.name, known),
    });
  }
  // the shelf tools, made up from the practice shelf
  if (route === "/api/collector/shelf") {
    const books = shelf.flatMap((m) => booksOf(seriesOf(m), m));
    return json(
      practiceShelfTools(shelf, (m) => new Map(knownOf(m)), spentOn(books)),
    );
  }
  if (route === "/api/collector/calendar")
    return json({ months: practiceCalendar(shelf, knownOf) });
  if (route === "/api/collector/deals") return json({ deals: [] });
  // practice answers come from the shelf itself, never saved
  if (route === "/api/manga/releases/saved") return json({ answers: {} });
  if (route === "/api/prices/highlights") {
    return json({ trending: [], deals: [], recent: [] });
  }
  if (route === "/api/prices/series-index") return json([]);
  if (route === "/api/prices/series-search" || route === "/api/prices/search") {
    return json({ results: [] });
  }
  const volume = route.match(/^\/api\/prices\/(\d{13})$/);
  if (volume) return json(volumePage(volume[1]!, shelf, collector));

  // a book removed: it goes, and so do its volumes unless another book of
  // theirs holds them too (as the server's removeBook)
  const removing = route.match(/^\/api\/manga\/(\d+)\/books\/(\d+)$/);
  if (removing && method === "DELETE") {
    const manga = shelf.find((m) => m.id === Number(removing[1]));
    if (!manga) return json({ error: [{ msg: "Not found" }] }, 404);
    const books = booksOf(seriesOf(manga), manga);
    const book = books.find((b) => b.id === Number(removing[2]));
    if (!book) return json({ error: [{ msg: "Not found" }] }, 404);
    const kept = new Set(
      books.filter((b) => b.id !== book.id).flatMap((b) => b.volumes),
    );
    const left = ownedVolumes(
      null,
      ownedOf(manga).filter((v) => kept.has(v) || !book.volumes.includes(v)),
    );
    writeShelf(shelf.map((m) => (m.id === manga.id ? { ...m, ...left } : m)));
    save(REMOVED_KEY, [...readSaved<number[]>(REMOVED_KEY, []), book.id]);
    return json(left);
  }

  // the "You finished vol. 8" card's cross: nothing to keep on a practice
  // shelf, so it just goes
  if (/^\/api\/manga\/\d+\/finished-volume$/.test(route))
    return json({ ok: true });

  // a book added by hand: kept for the tab, like the shelf
  const addTo = route.match(/^\/api\/manga\/(\d+)\/books$/);
  if (addTo && method === "POST") {
    const all = readSaved<Record<string, unknown[]>>(ADDED_KEY, {});
    all[addTo[1]!] = [
      ...(all[addTo[1]!] ?? []),
      ...((body.books as unknown[]) ?? []),
    ];
    save(ADDED_KEY, all);
    const manga = shelf.find((m) => m.id === Number(addTo[1]));
    return json({ books: manga ? booksOf(seriesOf(manga), manga) : [] });
  }

  // a price paid or the day bought, typed into one of the books
  const purchase = route.match(/^\/api\/manga\/\d+\/books\/(\d+)$/);
  if (purchase && method === "PATCH") {
    const typed = readSaved<Record<string, Purchase>>(PAID_KEY, {});
    typed[purchase[1]!] = { ...typed[purchase[1]!], ...(body as Purchase) };
    save(PAID_KEY, typed);
    return json({ ok: true });
  }

  // rating the volumes of a series on the practice shelf, and a few words
  const reviews = readSaved<Record<string, SavedReview>>(REVIEWS_KEY, {});
  const asReview = (r: SavedReview) => {
    const account = readAccount();
    return {
      ...r,
      by: account.displayName ?? account.defaultName,
      avatar: account.avatar,
      edited: false,
      yours: true,
      hidden: false,
    };
  };
  if (route === "/api/reviews/shelf" && method === "GET") {
    const id = Number(url.searchParams.get("manga"));
    const manga = shelf.find((m) => m.id === id);
    // the volume they're at, by volume, or else the last they own
    const newest = manga
      ? (manga.byVolume && manga.readVolume) || Math.max(0, ...ownedOf(manga))
      : 0;
    const isbnOfVolume = (volume: number) =>
      (manga && knownOf(manga).find(([v]) => v === volume)?.[1]) ?? null;
    const written = Object.entries(reviews)
      .filter(([key]) => key.startsWith(`${id}:`))
      .map(([key, r]) => {
        const volume = Number(key.split(":")[1]);
        return { volume, isbn13: isbnOfVolume(volume), review: asReview(r) };
      })
      .sort((a, b) => b.volume - a.volume);
    const latest = newest
      ? { volume: newest, isbn13: isbnOfVolume(newest) }
      : null;
    return json({
      latest,
      toRate: latest && !reviews[`${id}:${newest}`] ? [latest] : [],
      written,
      justFinished: null,
    });
  }
  const shelfReview = route.match(/^\/api\/reviews\/shelf\/(\d+)\/([\d.]+)$/);
  if (shelfReview) {
    const key = `${shelfReview[1]}:${shelfReview[2]}`;
    if (method === "DELETE") {
      delete reviews[key];
      save(REVIEWS_KEY, reviews);
      return json({ ok: true });
    }
    const review: SavedReview = {
      id: reviews[key]?.id ?? Date.now(),
      rating: Number(body.rating) || 0,
      text: String(body.text ?? ""),
      spoiler: Boolean(body.spoiler),
      writtenAt: new Date().toISOString(),
    };
    save(REVIEWS_KEY, { ...reviews, [key]: review });
    return json(asReview(review));
  }
  // a volume's page: nobody else's reviews on a practice shelf
  if (route.startsWith("/api/reviews/volume/") && method === "GET") {
    return json({
      count: 0,
      average: null,
      spread: [0, 0, 0, 0, 0],
      reviews: [],
      yours: null,
      mayWrite: "yes",
    });
  }

  const found = route.match(/^\/api\/manga\/(\d+)(?:\/(\w+))?$/);
  if (found) {
    const id = Number(found[1]);
    let manga = shelf.find((m) => m.id === id);
    // the red bar steps need the practice manga, so deleting it can't strand the tour
    if (!manga && !collector && id === 1 && method === "GET") {
      manga = STARTING_SHELF[0]!;
      writeShelf([manga, ...shelf]);
    }
    if (!manga) return json({ error: [{ msg: "Not found" }] }, 404);
    const part = found[2];
    if (!part && method === "DELETE") {
      forget([manga]);
      writeShelf(shelf.filter((m) => m.id !== id));
      return json({ ok: true });
    }
    if (!part && method === "PUT") {
      const novel = body.lightNovel ?? manga.lightNovel;
      if (
        shelf.some(
          (m) =>
            m.id !== id &&
            sameTitle(m.name, body.name) &&
            Boolean(m.lightNovel) === Boolean(novel),
        )
      ) {
        return TITLE_TAKEN();
      }
      writeShelf(
        shelf.map((m) => (m.id === id ? { ...m, ...fromForm(body) } : m)),
      );
      return json({ ok: true });
    }
    if (part === "owned") {
      const owned = ownedVolumes(
        (body.volumesOwned as number | null) ?? null,
        (body.ownedList as number[] | undefined) ?? [],
      );
      writeShelf(shelf.map((m) => (m.id === id ? { ...m, ...owned } : m)));
      return json(owned);
    }
    // ordered, on their way, as the server keeps them (owned ones drop off)
    if (part === "ordered") {
      const volumes = (body.volumes as number[] | undefined) ?? [];
      const owned = new Set(ownedOf(manga));
      const others = (manga.orderedList ?? []).filter(
        (v) => !volumes.includes(v),
      );
      const orderedList = (
        body.ordered ? [...new Set([...others, ...volumes])] : others
      )
        .filter((v) => !owned.has(v))
        .sort((x, y) => x - y);
      writeShelf(shelf.map((m) => (m.id === id ? { ...m, orderedList } : m)));
      return json({ orderedList });
    }
    if (part === "releases")
      return json(
        collector
          ? collectorReleases(manga, knownOf(manga))
          : releasesFor(manga, kind),
      );
    // the collector's books, as the file has them; the reader's shelf keeps
    // none. Saving a price paid isn't kept: the tour only shows it
    if (part === "books")
      return json({ books: booksOf(seriesOf(manga), manga) });
    if (!part && method === "GET") return json({ manga });
    const changes = changesFor(part, body);
    writeShelf(shelf.map((m) => (m.id === id ? { ...m, ...changes } : m)));
    return json({ ok: true });
  }

  return json({ error: [{ msg: "Not part of the tour" }] }, 404);
}

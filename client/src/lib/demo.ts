// The guided tour's pretend account. While it's on, apiFetch answers from here, so
// every real page works on a practice shelf and nothing reaches the server: no real
// data can change and no paid price search can run. It lives in this tab and goes
// when the tour ends.
import type { MalEntry } from "./malImport";
import type { Manga } from "./types";

const ON_KEY = "demoTour";
const SHELF_KEY = "demoShelf";
const ACCOUNT_KEY = "demoAccount";
const PREFS_KEY = "demoPrefs";
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
  practice(1, "One Piece", "Action", "bx30013-BeslEMqiPhlk.jpg", {
    bookmark: 1100,
    volumesOwned: 40,
  }),
  practice(
    2,
    "Frieren: Beyond Journey's End",
    "Adventure",
    "bx118586-CXKgWikBFQgS.jpg",
    {
      bookmark: 90,
      volumesOwned: 9,
      rating: 5,
    },
  ),
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

const readShelf = (): Manga[] => {
  try {
    const saved = sessionStorage.getItem(SHELF_KEY);
    if (saved) return JSON.parse(saved) as Manga[];
  } catch {
    /* start over */
  }
  return STARTING_SHELF;
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
export const wasSignedInBeforeTour = () => {
  try {
    return sessionStorage.getItem(WAS_SIGNED_IN_KEY) === "yes";
  } catch {
    return false;
  }
};

export function startDemo(wasSignedIn = false) {
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

// One Piece has a new volume out, Chainsaw Man a new chapter, and the rest are
// caught up, so the red bar and the New tab have something real to show
function releasesFor(m: Manga) {
  const volumeOut = m.id === 1 && (m.seenVolume ?? 0) < NEW_VOLUME;
  const chapterOut = m.id === 3 && (m.seenChapter ?? 0) < 123;
  const nextVolume = m.id === 1 ? NEW_VOLUME : null;
  const latestChapter = m.id === 3 ? 123 : m.bookmark;
  return {
    releaseData:
      m.id === 1
        ? {
            volume: [{ volume: String(NEW_VOLUME), releaseDate: days(-40) }],
            newVolume: {
              volume: String(NEW_VOLUME + 1),
              releaseDate: days(60),
              isEstimate: true,
            },
          }
        : m.id === 3
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
      volumeMode: "next",
      chapterMode: "within",
      volumeListed: m.id === 1,
      chapterListed: m.id === 3,
      japanListed: false,
      isNextVolumeOut: m.id === 1,
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

const NEW_VOLUME = 41;
const isbnOf = (volume: number) =>
  `978000000${String(volume).padStart(4, "0")}`;

const seriesVolumes = (name: string, cover: string | null) =>
  Array.from({ length: NEW_VOLUME }, (_, i) => ({
    isbn13: isbnOf(i + 1),
    title: `${name}, Vol. ${i + 1}`,
    volume: i + 1,
    coverUrl: cover ?? "",
    knownPriceCents: 899,
  }));

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

function volumePage(isbn: string, shelf: Manga[]) {
  // One Piece, wherever it is on the shelf and even if they've deleted it
  const manga = shelf.find((m) => m.id === 1) ?? STARTING_SHELF[0]!;
  const volume = Number(isbn.slice(-4)) || NEW_VOLUME;
  const series = { name: manga.name, slug: "one-piece", info: null };
  return {
    series,
    volume,
    siblings: seriesVolumes(manga.name, manga.image),
    book: {
      isbn13: isbn,
      title: `${manga.name}, Vol. ${volume}`,
      authors: "Eiichiro Oda",
      publisher: "VIZ Media",
      coverUrl: manga.image,
      year: 2024,
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

const STARTING_ACCOUNT = {
  username: "practice",
  displayName: null as string | null,
  avatar: "kenji" as string | null,
  recoveryEmail: null,
  shareEnabled: false,
  shareNotes: false,
  shareCode: "practice" as string | null,
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
  volumesOwned: Number(body.volumesOwned) || null,
});

// what the app's own server would say, for what the tour can reach. Anything else
// is a plain "not found": it must never go looking on the real server
export function demoResponse(
  path: string,
  method = "GET",
  rawBody?: string,
): Promise<Response> {
  const url = new URL(path, "https://demo.invalid");
  const route = url.pathname;
  const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  const shelf = readShelf();

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
  if (route === "/api/manga/restore") {
    const manga = body as unknown as Manga;
    if (shelf.some((m) => m.id === manga.id)) return json({ ok: true }, 409);
    writeShelf([...shelf, manga]);
    return json({ ok: true });
  }
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
        // as the server does: volumes read when they haven't said what they own
        volumesOwned: entry.ownedVolumes || entry.readVolumes || null,
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
  if (route === "/api/manga/match") return json(null);
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
    const manga = shelf.find((m) => m.name === name);
    return json({
      name,
      slug: "practice",
      info: null,
      incomplete: false,
      volumes: manga?.id === 1 ? seriesVolumes(name, manga.image) : [],
    });
  }
  if (route === "/api/prices/highlights") {
    return json({ trending: [], deals: [], recent: [] });
  }
  if (route === "/api/prices/series-index") return json([]);
  if (route === "/api/prices/series-search" || route === "/api/prices/search") {
    return json({ results: [] });
  }
  const volume = route.match(/^\/api\/prices\/(\d{13})$/);
  if (volume) return json(volumePage(volume[1]!, shelf));

  const found = route.match(/^\/api\/manga\/(\d+)(?:\/(\w+))?$/);
  if (found) {
    const id = Number(found[1]);
    let manga = shelf.find((m) => m.id === id);
    // the red bar steps need One Piece, so deleting it can't strand the tour
    if (!manga && id === 1 && method === "GET") {
      manga = STARTING_SHELF[0]!;
      writeShelf([manga, ...shelf]);
    }
    if (!manga) return json({ error: [{ msg: "Not found" }] }, 404);
    const part = found[2];
    if (!part && method === "DELETE") {
      writeShelf(shelf.filter((m) => m.id !== id));
      return json({ ok: true });
    }
    if (!part && method === "PUT") {
      if (shelf.some((m) => m.id !== id && sameTitle(m.name, body.name))) {
        return TITLE_TAKEN();
      }
      writeShelf(
        shelf.map((m) => (m.id === id ? { ...m, ...fromForm(body) } : m)),
      );
      return json({ ok: true });
    }
    if (part === "owned") {
      const volumesOwned = body.volumesOwned as number | null;
      writeShelf(shelf.map((m) => (m.id === id ? { ...m, volumesOwned } : m)));
      return json({ volumesOwned });
    }
    if (part === "releases") return json(releasesFor(manga));
    if (!part && method === "GET") return json({ manga });
    const changes: Partial<Manga> =
      part === "bookmark"
        ? { bookmark: body.bookmark as number }
        : part === "rating"
          ? { rating: body.rating as number }
          : part === "notes"
            ? { description: body.description as string | null }
            : part === "status"
              ? { status: body.status as boolean, planned: false }
              : part === "planned"
                ? body.planned
                  ? { planned: true, status: false }
                  : { planned: false, bookmark: 1 }
                : part === "seen"
                  ? {
                      [body.kind === "chapter" ? "seenChapter" : "seenVolume"]:
                        body.number as number | null,
                    }
                  : {};
    writeShelf(shelf.map((m) => (m.id === id ? { ...m, ...changes } : m)));
    return json({ ok: true });
  }

  return json({ error: [{ msg: "Not part of the tour" }] }, 404);
}

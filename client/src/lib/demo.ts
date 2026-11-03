// The guided tour's pretend account. While it's on, apiFetch answers from here, so
// every real page works on a practice shelf and nothing reaches the server: no real
// data can change and no paid price search can run. It lives in this tab and goes
// when the tour ends.
import type { Manga } from "./types";

const ON_KEY = "demoTour";
const SHELF_KEY = "demoShelf";
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
  practice(2, "Frieren: Beyond Journey's End", "Adventure", "bx118586-CXKgWikBFQgS.jpg", {
    bookmark: 90,
    volumesOwned: 9,
    rating: 5,
  }),
  practice(3, "Chainsaw Man", "Action", "bx105778-euxXZEIfDY2u.png", { bookmark: 120 }),
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
export function startDemo() {
  try {
    sessionStorage.setItem(ON_KEY, "on");
    sessionStorage.removeItem(SHELF_KEY);
    sessionStorage.removeItem("demoTourStep");
    sessionStorage.setItem("libraryStatus", "all");
  } catch {
    return;
  }
  window.location.assign("/shelf");
}

export function endDemo(to = "/") {
  try {
    sessionStorage.removeItem(ON_KEY);
    sessionStorage.removeItem(SHELF_KEY);
    sessionStorage.removeItem("demoTourStep");
    sessionStorage.removeItem("libraryStatus");
    // the pretend account shouldn't look like a real sign-in next time
    localStorage.removeItem("signedInBefore");
  } catch {
    /* nothing to tidy */
  }
  window.location.assign(to);
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

const NO_RELEASES = { releaseData: null, releaseStatus: null, complete: true };

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
  if (route === "/api/prefs") return json({});
  if (route === "/api/manga" && method === "GET") return json({ manga: shelf });
  if (route === "/api/manga" && method === "POST") {
    const id = Math.max(0, ...shelf.map((m) => m.id)) + 1;
    writeShelf([...shelf, practice(id, String(body.name), "", "", { image: null })]);
    return json({ id }, 201);
  }
  if (route === "/api/manga/match") return json(null);

  const found = route.match(/^\/api\/manga\/(\d+)(?:\/(\w+))?$/);
  if (found) {
    const id = Number(found[1]);
    const manga = shelf.find((m) => m.id === id);
    if (!manga) return json({ error: [{ msg: "Not found" }] }, 404);
    const part = found[2];
    if (part === "releases") return json(NO_RELEASES);
    if (!part && method === "GET") return json({ manga });
    const changes: Partial<Manga> =
      part === "bookmark"
        ? { bookmark: body.bookmark as number }
        : part === "rating"
          ? { rating: body.rating as number }
          : part === "notes"
            ? { description: body.description as string | null }
            : part === "status"
              ? { status: body.status as boolean }
              : {};
    writeShelf(shelf.map((m) => (m.id === id ? { ...m, ...changes } : m)));
    return json({ ok: true });
  }

  return json({ error: [{ msg: "Not part of the tour" }] }, 404);
}

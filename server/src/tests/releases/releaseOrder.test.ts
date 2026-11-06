// What a shelf checks first, which lane it waits in, and what's skipped
import { laneQueue } from "../../util/releases/laneQueue.js";
import { checkOrder, laneOf } from "../../../../client/src/lib/releaseOrder.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("the two lanes", () => {
  const make = () => {
    const ran: string[] = [];
    const q = laneQueue<string>({
      pauseMs: 0,
      maxLater: 3,
      onFailure: "failed",
    });
    const job =
      (key: string, ms = 5) =>
      async () => {
        ran.push(key);
        await sleep(ms);
        return key;
      };
    return { q, ran, job };
  };

  test("now goes before later, later runs once now is empty, one at a time", async () => {
    const { q, ran, job } = make();
    const answers = await Promise.all([
      q.add("a", "later", job("a")),
      q.add("b", "later", job("b")),
      q.add("c", "now", job("c")),
      q.add("d", "now", job("d")),
    ]);
    // "a" had already started when the rest came in: it finishes first
    expect(ran).toEqual(["a", "c", "d", "b"]);
    expect(answers).toEqual(["a", "b", "c", "d"]);
  });

  test("asked for now while waiting in later: it moves up", async () => {
    const { q, ran, job } = make();
    const all = [
      q.add("x", "now", job("x", 20)),
      q.add("y", "later", job("y")),
      q.add("z", "later", job("z")),
      q.add("w", "now", job("w")),
    ];
    q.promote("z");
    await Promise.all(all);
    expect(ran).toEqual(["x", "w", "z", "y"]);
  });

  test("later is capped, now never is", async () => {
    const { q, job } = make();
    const first = q.add("busy", "now", job("busy", 20));
    const later = ["1", "2", "3", "4"].map((k) => q.add(k, "later", job(k)));
    expect(later.map((p) => p === null)).toEqual([false, false, false, true]);
    expect(q.add("5", "now", job("5"))).not.toBeNull();
    await Promise.all([first, ...later.filter(Boolean)]);
  });

  test("a failed check is an answer, and the queue keeps going", async () => {
    const { q, job } = make();
    const bad = q.add("bad", "now", async () => {
      throw new Error("MangaDex down");
    });
    const good = q.add("good", "now", job("good"));
    expect(await Promise.all([bad, good])).toEqual(["failed", "good"]);
  });
});

describe("the shelf's order", () => {
  const m = (id: number, over: Record<string, unknown> = {}) => ({
    id,
    bookmark: null as number | null,
    latestChapter: null as number | null,
    rating: null as number | null,
    planned: false,
    status: false,
    ...over,
  });
  const shelf = [
    m(1, { status: true }), // finished reading
    m(2, { planned: true }), // to read
    m(3, { rating: 4 }),
    m(4, { bookmark: 100, latestChapter: 102 }), // caught up
    m(5, { rating: 5 }),
    m(6), // reading, never checked
    m(7, { bookmark: 10, latestChapter: 200 }), // reading, far behind
    m(8, { rating: 5 }), // newer 5 stars
    m(9, { bookmark: 50, latestChapter: 53, rating: 4 }), // caught up and rated
  ];
  test("caught up, 5 stars, 4 stars, then reading, to read, finished; newest first", () => {
    expect(checkOrder(shelf).map((x) => x.id)).toEqual([
      9, 4, 8, 5, 3, 7, 6, 2, 1,
    ]);
  });
  test("only the first three groups wait in now", () => {
    expect(
      shelf
        .map((x) => [x.id, laneOf(x)])
        .filter(([, l]) => l === "now")
        .map(([id]) => id),
    ).toEqual([3, 4, 5, 8, 9]);
  });
  test("finished reading alone isn't caught up, and 4 chapters behind isn't either", () => {
    expect(laneOf(m(1, { status: true }))).toBe("later");
    expect(laneOf(m(1, { bookmark: 96, latestChapter: 100 }))).toBe("later");
    expect(laneOf(m(1, { bookmark: 97, latestChapter: 100 }))).toBe("now");
  });
});

test("skipped only when AniList says the series finished and every volume is owned", async () => {
  const { nothingLeftToCheck } =
    await import("../../controllers/mangaController.js");
  const fma = { status: "FINISHED", volumes: 27 };
  expect(nothingLeftToCheck({ volumesOwned: 27 }, fma)).toBe(true);
  expect(nothingLeftToCheck({ volumesOwned: 30 }, fma)).toBe(true);
  // English volumes still to come for them
  expect(nothingLeftToCheck({ volumesOwned: 20 }, fma)).toBe(false);
  expect(nothingLeftToCheck({ volumesOwned: null }, fma)).toBe(false);
  // still coming out, on a break, or AniList doesn't know how many
  expect(
    nothingLeftToCheck(
      { volumesOwned: 110 },
      { status: "RELEASING", volumes: 110 },
    ),
  ).toBe(false);
  expect(
    nothingLeftToCheck({ volumesOwned: 40 }, { status: "HIATUS", volumes: 41 }),
  ).toBe(false);
  expect(
    nothingLeftToCheck(
      { volumesOwned: 27 },
      { status: "FINISHED", volumes: null },
    ),
  ).toBe(false);
  expect(nothingLeftToCheck({ volumesOwned: 27 }, null)).toBe(false);
});

test("a finished series at its last chapter isn't caught up (it's done, not waiting)", () => {
  const m = (over: Record<string, unknown>) => ({
    id: 1,
    bookmark: 120,
    latestChapter: 120,
    rating: null,
    planned: false,
    status: false,
    ...over,
  });
  expect(laneOf(m({}))).toBe("now");
  expect(laneOf(m({ status: true }))).toBe("later");
  expect(laneOf(m({ planned: true }))).toBe("later");
  // a 5-star finished one still goes with the 5 stars
  expect(laneOf(m({ status: true, rating: 5 }))).toBe("now");
});

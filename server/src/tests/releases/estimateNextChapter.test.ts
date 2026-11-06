import { jest } from "@jest/globals";
import { estimateNextChapter } from "../../util/releases/estimateNextChapter.js";

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

// MangaDex's feed answering with these chapters
const feed = (chapters: [chapter: string, publishAt: string][]) => {
  global.fetch = jest.fn(async () =>
    Response.json({
      data: chapters.map(([chapter, publishAt]) => ({
        attributes: { chapter, publishAt },
      })),
    }),
  ) as typeof fetch;
};

test("chapters uploaded in bulk give no estimate, and don't hang", async () => {
  // a gap of 0 used to loop forever, which froze the whole server
  const same = "2020-01-01T00:00:00Z";
  feed([
    ["1", same],
    ["2", same],
    ["3", same],
    ["4", same],
    ["5", same],
  ]);
  const estimate = await estimateNextChapter("series");
  expect(estimate.method).toBe("none");
  expect(estimate.estimatedAt).toBeNull();
});

test("a steady schedule still gets an estimate in the future", async () => {
  // fortnightly, the last one out a week ago
  const day = 24 * 60 * 60 * 1000;
  feed(
    ["1", "2", "3", "4", "5"].map((chapter, i): [string, string] => [
      chapter,
      new Date(Date.now() - (7 + (4 - i) * 14) * day).toISOString(),
    ]),
  );
  const estimate = await estimateNextChapter("series");
  expect(estimate.method).toBe("estimated");
  expect(estimate.nextChapter).toBe("6");
  expect(estimate.estimatedAt!.getTime()).toBeGreaterThan(Date.now());
});

test("the scheduled chapter query only asks for chapters still to come", async () => {
  feed([]);
  await estimateNextChapter("series");
  const firstUrl = String((global.fetch as jest.Mock).mock.calls[0]![0]);
  expect(firstUrl).toContain("publishAtSince=");
});

test("a series that stopped long ago gets no date", async () => {
  // a steady schedule, years in the past
  feed(
    ["1", "2", "3", "4", "5"].map((chapter, i): [string, string] => [
      chapter,
      new Date(Date.UTC(2015, 0, 1 + i * 14)).toISOString(),
    ]),
  );
  const estimate = await estimateNextChapter("series");
  expect(estimate.method).toBe("none");
  expect(estimate.estimatedAt).toBeNull();
});

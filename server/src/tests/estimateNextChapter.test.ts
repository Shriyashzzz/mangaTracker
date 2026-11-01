import { jest } from "@jest/globals";
import { estimateNextChapter } from "../util/estimateNextChapter.js";

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
  feed([["1", same], ["2", same], ["3", same], ["4", same], ["5", same]]);
  const estimate = await estimateNextChapter("series");
  expect(estimate.method).toBe("none");
  expect(estimate.estimatedAt).toBeNull();
});

test("a steady schedule still gets an estimate in the future", async () => {
  feed([
    ["1", "2020-01-01T00:00:00Z"],
    ["2", "2020-01-15T00:00:00Z"],
    ["3", "2020-01-29T00:00:00Z"],
    ["4", "2020-02-12T00:00:00Z"],
    ["5", "2020-02-26T00:00:00Z"],
  ]);
  const estimate = await estimateNextChapter("series");
  expect(estimate.method).toBe("estimated");
  expect(estimate.nextChapter).toBe("6");
  expect(estimate.estimatedAt!.getTime()).toBeGreaterThan(Date.now());
});

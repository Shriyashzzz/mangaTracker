import { mangaOutcome } from "../../util/releases/releaseOutcome.js";

const found = { volumes: [] };

test("news from either site, asked again only if the other didn't answer", () => {
  expect(mangaOutcome({ ok: true, hasData: true }, found)).toEqual({
    outcome: "news",
    complete: true,
  });
  expect(mangaOutcome({ ok: true, hasData: true }, null)).toEqual({
    outcome: "news",
    complete: true,
  });
  expect(mangaOutcome({ ok: true, hasData: false }, found)).toEqual({
    outcome: "news",
    complete: true,
  });
  // the catalog failed: what MangaDex said stands, the volumes are asked again
  expect(mangaOutcome({ ok: true, hasData: true }, undefined)).toEqual({
    outcome: "news",
    complete: false,
  });
  // MangaDex failed: the catalog's volumes stand, chapters are asked again
  expect(mangaOutcome({ ok: false, hasData: false }, found)).toEqual({
    outcome: "news",
    complete: false,
  });
});

test("both answered and neither has it: not found, not asked again", () => {
  expect(mangaOutcome({ ok: true, hasData: false }, null)).toEqual({
    outcome: "notFound",
    complete: true,
  });
});

test("a site that didn't answer is a failure, never 'not found'", () => {
  expect(mangaOutcome({ ok: false, hasData: false }, null)).toEqual({
    outcome: "failed",
    complete: false,
  });
  expect(mangaOutcome({ ok: true, hasData: false }, undefined)).toEqual({
    outcome: "failed",
    complete: false,
  });
  expect(mangaOutcome({ ok: false, hasData: false }, undefined)).toEqual({
    outcome: "failed",
    complete: false,
  });
});

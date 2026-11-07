import { pool } from "../../config/prisma.js";
import {
  isComplete,
  lacksNativeName,
  withAltNames,
} from "../../prices/sources/anilist.js";
import { canonicalTitle } from "../../util/shelf/canonicalTitle.js";
import type { SeriesInfo } from "../../prices/types.js";

afterAll(() => pool.end());

// a row saved before altNames existed, which crashed adding a manga
const oldRow = { name: "One Piece" } as SeriesInfo;

test("a row without altNames is asked for afresh", () => {
  expect(isComplete(oldRow)).toBe(false);
  expect(isComplete({ name: "One Piece", altNames: [] })).toBe(true);
  // nothing found on AniList is a real answer
  expect(isComplete(null)).toBe(true);
});

test("a row from before the native name is topped up later, not refused", () => {
  expect(lacksNativeName({ name: "One Piece", altNames: [] })).toBe(true);
  expect(lacksNativeName({ name: "X", altNames: [], nativeName: null })).toBe(
    false,
  );
  expect(lacksNativeName(null)).toBe(false);
});

test("an old row can't crash adding a manga when AniList is down", () => {
  expect(canonicalTitle("one piece", withAltNames(oldRow))).toBe("One Piece");
});

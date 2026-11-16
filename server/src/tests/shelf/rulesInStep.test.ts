// Rules the page and the server each keep a copy of (Railway builds each app
// from its own folder, so neither imports the other's): the copies must
// answer the same. A change to one without the other fails here
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as clientReading from "../../../../client/src/lib/reading.js";
import { bookName as pageBookName } from "../../../../client/src/lib/bookName.js";
import { bookName } from "../../prices/editionLines.js";
import { readTrackBy, tracksOf } from "../../util/releases/releaseStatus.js";
import { MOST_TOP } from "../../util/shelf/shareTop.js";

test("which counters a series shows: chapters, volumes or both", () => {
  for (const setting of [
    "series",
    "chapters",
    "volumes",
    "both",
    "nonsense",
    undefined,
  ])
    for (const byVolume of [true, false, undefined]) {
      const server = tracksOf(byVolume, readTrackBy(setting));
      const page = clientReading.tracksOf(
        { byVolume },
        clientReading.readTrackBy(setting),
      );
      expect([setting, byVolume, page]).toEqual([setting, byVolume, server]);
    }
});

test("a shared shelf's top picks: the page stops at the server's limit", () => {
  const topPick = fileURLToPath(
    new URL(
      "../../../../client/src/pages/SharedShelf/TopPick.tsx",
      import.meta.url,
    ),
  );
  const found = readFileSync(topPick, "utf8").match(/const MOST_TOP = (\d+);/);
  expect(Number(found?.[1])).toBe(MOST_TOP);
});

test("a book of an edition is named the same on the page and the server", () => {
  for (const label of ["2-in-1", "3-in-1", "Deluxe", "Omnibus", "VIZBIG"])
    for (const number of [1, 12])
      expect(pageBookName(label, number)).toBe(bookName(label, number));
  expect(bookName("2-in-1", 1)).toBe("2-in-1 Book 1");
  expect(bookName("Deluxe", 3)).toBe("Deluxe 3");
});

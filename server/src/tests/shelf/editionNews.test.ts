// The New tab for someone collecting an edition
// (client/src/lib/editionNews.ts)
import {
  editionNews,
  editionReleases,
  forEdition,
} from "../../../../client/src/lib/editionNews.js";
import type { Manga, ReleaseStatus } from "../../../../client/src/lib/types.js";

const place = (next: number | null, behind: number, upTo: number | null) => ({
  label: "VIZBIG",
  read: null,
  owned: null,
  next,
  behind,
  upTo,
});
// vol. 13 is out and they don't have it, as a release check says it
const found = {
  hasNewVolume: true,
  volumeListed: true,
  hasNewChapter: true,
} as ReleaseStatus;

test("a card says the next book, and how many books behind", () => {
  expect(editionNews({ editionPlace: place(5, 8, 4) })).toEqual({
    text: "VIZBIG 5 next",
    behind: "8 books behind",
    yours: "You have up to VIZBIG 4",
    count: 8,
  });
  // one behind is the next one: news, never "behind"
  expect(
    editionNews({ editionPlace: place(12, 1, 11) })?.behind,
  ).toBeUndefined();
  // none yet
  expect(
    editionNews({ editionPlace: place(1, 12, null) })?.yours,
  ).toBeUndefined();
  // single volumes, and an edition with nothing next: nothing to say in books
  expect(editionNews({ editionPlace: null })).toBeNull();
  expect(editionNews({ editionPlace: place(null, 0, 12) })).toBeNull();
});

test("someone with every book of their edition has no volume news", () => {
  const all = forEdition({ editionPlace: place(null, 0, 12) }, found);
  expect(all?.hasNewVolume).toBe(false);
  expect(all?.volumeListed).toBe(false);
  // chapters are theirs to hear about still
  expect(all?.hasNewChapter).toBe(true);
  // a book still to get: the news stands, counted and named in books
  const some = forEdition({ editionPlace: place(5, 8, 4) }, found);
  expect(some?.hasNewVolume).toBe(true);
  expect(some?.editionBooks).toEqual({ label: "VIZBIG", next: 5, behind: 8 });
  // single volumes, and a place sent before books were counted: untouched
  expect(forEdition({ editionPlace: null }, found)).toBe(found);
  const old = { label: "VIZBIG", read: 4, owned: [1] };
  expect(forEdition({ editionPlace: old }, found)).toBe(found);
  expect(forEdition({ editionPlace: place(null, 0, 12) }, null)).toBeNull();
});

test("a whole shelf's answers, only the collected ones read in books", () => {
  const manga = [
    { id: 1, editionPlace: place(null, 0, 12) },
    { id: 2, editionPlace: null },
    { id: 3, editionPlace: place(null, 0, 12) },
  ] as Manga[];
  const releases = { 1: found, 2: found };
  const read = editionReleases(manga, releases);
  expect(read[1]?.hasNewVolume).toBe(false);
  expect(read[2]).toBe(found);
  // not checked yet: still not there
  expect(3 in read).toBe(false);
  // nobody collects an edition: the very same answers
  expect(editionReleases([manga[1]!], releases)).toBe(releases);
});

test("the New tab counts and names an edition's books", async () => {
  const { behindOf, nextVolumeName } =
    await import("../../../../client/src/lib/releaseMath.js");
  // by the volume: owns up to vol. 12 of 37, with two gaps behind
  const byVolume = {
    ...found,
    currentVolume: 12,
    latestVolume: 37,
    nextVolume: 13,
    gapVolumes: [{ volume: 2 }, { volume: 3 }],
    outVolumes: [],
    outJapanVolumes: [],
  } as unknown as ReleaseStatus;
  expect(behindOf(byVolume, "volumes")).toBe(27);
  expect(nextVolumeName(byVolume)).toBe("Vol. 13");
  // the same series collected as VIZBIG
  const inBooks = forEdition({ editionPlace: place(5, 8, 4) }, byVolume);
  expect(behindOf(inBooks, "volumes")).toBe(8);
  expect(nextVolumeName(inBooks)).toBe("VIZBIG 5");
});

// ---------- the day an edition's next book comes out ----------
test("an edition's next book is news when it's just out, or has a day", async () => {
  const { editionRelease, fullDayOf } =
    await import("../../../../client/src/lib/editionNews.js");
  const three = (book: number) => [book * 3 - 2, book * 3 - 1, book * 3];
  // four VIZBIGs: three out, the fourth with a day
  const lineOf = (days: (string | null)[]) => ({
    key: "vizbig",
    kind: "omnibus" as const,
    label: "VIZBIG",
    books: days.map((published, i) => ({
      number: i + 1,
      volumes: three(i + 1),
      isbn13: `978142150000${i}`,
      title: null,
      listed: true,
      published,
    })),
  });
  const today = "2026-11-19";
  const line = lineOf(["2020-01-07", "2020-04-07", "2026-11-10", "2027-03-04"]);
  const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  // owns books 1 and 2: the third is the newest out
  expect(editionRelease(line, upTo(6), null, today)).toMatchObject({
    isOut: true,
    day: "2026-11-10",
    book: { number: 3 },
  });
  // owns all three: the fourth has a day
  expect(editionRelease(line, upTo(9), null, today)).toMatchObject({
    isOut: false,
    day: "2027-03-04",
    book: { number: 4 },
  });
  // reads them without owning any: read up to vol. 6 is the same place
  expect(editionRelease(line, [], 6, today)?.book.number).toBe(3);
  // only book 1: two are out past it, which is being behind, not news
  expect(editionRelease(line, upTo(3), null, today)).toBeNull();
  // a gap behind their furthest: not news either
  expect(editionRelease(line, [4, 5, 6], null, today)).toBeNull();
  // none of the edition yet, and all of it
  expect(editionRelease(line, [], null, today)).toBeNull();
  expect(editionRelease(line, upTo(12), null, today)).toBeNull();

  // a year alone is never said
  const vague = lineOf(["2020-01-07", "2020-04-07", "2026", null]);
  expect(editionRelease(vague, upTo(6), null, today)).toBeNull();
  expect(fullDayOf("2026")).toBeNull();
  expect(fullDayOf("2026-03")).toBeNull();
  expect(fullDayOf("2026-03-04")).toBe("2026-03-04");
  // a book after it with no day: it may be out too, so nothing is claimed
  const unknownAfter = lineOf(["2020-01-07", "2026-11-10", null]);
  expect(editionRelease(unknownAfter, upTo(3), null, today)).toBeNull();
});

test("a book that isn't out yet stays off the New tab", () => {
  const coming = {
    ...place(13, 1, 12),
    nextPublished: "2999-01-01",
  };
  const read = forEdition({ editionPlace: coming }, found);
  expect(read?.hasNewVolume).toBe(false);
  // out already, or with no day known: it's theirs to hear about
  const out = { ...place(13, 1, 12), nextPublished: "2020-01-01" };
  expect(forEdition({ editionPlace: out }, found)?.editionBooks?.next).toBe(13);
  const undated = { ...place(13, 1, 12), nextPublished: null };
  expect(forEdition({ editionPlace: undated }, found)?.hasNewVolume).toBe(true);
});

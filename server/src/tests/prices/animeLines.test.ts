import {
  reachesTheEnd,
  readAnimeStops,
  seasonName,
} from "../../prices/afterAnime/animeLines.js";

// every line below is one MangaUpdates gave, as it was written

test("one stop per season, each with the chapter and volume to read next", () => {
  const stops = readAnimeStops(
    "Vol 1, Chap 1 (S1) / Vol 8, Chap 64 (S2) / Vol 16, Chap 138 (S3)",
    "Vol 8, Chap 63 (S1) / Vol 16, Chap 137 (S2) / Vol 21, Chap 181 Page 14 (S3)",
  );
  expect(stops).toEqual([
    {
      label: "Season 1",
      endVolume: 8,
      endChapter: 63,
      endsMidChapter: false,
      nextChapter: 64,
      nextVolume: 8,
      note: "",
    },
    {
      label: "Season 2",
      endVolume: 16,
      endChapter: 137,
      endsMidChapter: false,
      nextChapter: 138,
      nextVolume: 16,
      note: "",
    },
    // stopped partway through 181, so that's the chapter to read; no later
    // season says which volume, so that's left open
    {
      label: "Season 3",
      endVolume: 21,
      endChapter: 181,
      endsMidChapter: true,
      nextChapter: 181,
      nextVolume: null,
      note: "",
    },
  ]);
});

test("a season that ends with its volume carries on in the next one", () => {
  const [first] = readAnimeStops(
    "Vol 1, Chap 1 (S1) / Vol 12, Chap 95 (S2)",
    "Vol 11, Chap 94 (S1) / Vol 17, Chap 149 (S2)",
  );
  expect(first).toMatchObject({
    endVolume: 11,
    nextChapter: 95,
    nextVolume: 12,
  });
});

test("what's said after a season is kept as its note", () => {
  const stops = readAnimeStops(
    "Vol 1, Chap 1 (S1) / Vol 5, Chap 39 (Reze Movie)",
    "Vol 5, Chap 38 (S1) Skips most of Chap 2 / Vol 6, Chap 52 (Reze Movie)",
  );
  expect(stops.map((stop) => [stop.label, stop.note])).toEqual([
    ["Season 1", "Skips most of Chap 2"],
    ["Reze Movie", ""],
  ]);
});

test("a line with no season named is the anime", () => {
  expect(readAnimeStops("Vol 1, Chap 1", "Vol 4, Chap 17")).toEqual([
    {
      label: "The anime",
      endVolume: 4,
      endChapter: 17,
      endsMidChapter: false,
      nextChapter: 18,
      nextVolume: null,
      note: "",
    },
  ]);
});

test("a bracket that's a remark is a note, not a season's name", () => {
  const [stop] = readAnimeStops(
    "Vol 1, Chap 1",
    "Vol 6, Chap 40 (Skips Chap 32, Partly skips Chap 23-24, 27)",
  );
  expect(stop).toMatchObject({
    label: "The anime",
    endChapter: 40,
    note: "Skips Chap 32, Partly skips Chap 23-24, 27",
  });
});

test("chapters alone, volumes alone, and a missing comma are all read", () => {
  expect(
    readAnimeStops(
      "Chap 0 (S1) / Chap 46 (S2)",
      "Chap 45 (S1) / Chap 110 (S2)",
    ),
  ).toMatchObject([
    { label: "Season 1", endVolume: null, endChapter: 45, nextChapter: 46 },
    { label: "Season 2", endVolume: null, endChapter: 110, nextChapter: 111 },
  ]);
  expect(
    readAnimeStops(
      "Vol 1, Chap 1 (1992/Crystal)",
      "Vol 18 (1996) Different throughout with an original ending",
    ),
  ).toMatchObject([
    {
      label: "1996",
      endVolume: 18,
      endChapter: null,
      nextChapter: null,
      note: "Different throughout with an original ending",
    },
  ]);
  expect(
    readAnimeStops("Vol 1, Chap 1 (S1)", "Vol 6 Chap 47 (S1)  "),
  ).toMatchObject([{ endVolume: 6, endChapter: 47 }]);
});

test("after a half chapter comes the next whole one", () => {
  const [stop] = readAnimeStops(
    "Vol 1, Chap 0 (S1P1 + OVA 1)",
    "Vol 5, Chap 22.5 (S1P2)",
  );
  expect(stop).toMatchObject({
    label: "Season 1 part 2",
    endChapter: 22.5,
    nextChapter: 23,
  });
});

test("a slash inside a name doesn't split a season in two", () => {
  const stops = readAnimeStops(
    "Vol 1, Chap 1 (1989/2024) / Vol 22, Chap 230 (OVA 1)",
    "Vol 22, Chap 229 (1989) / Vol 10, Chap 99 (2024 S2) Skips 51-58",
  );
  expect(stops.map((stop) => stop.label)).toEqual(["1989", "2024 Season 2"]);
  expect(stops[0]).toMatchObject({ nextChapter: 230, nextVolume: 22 });
});

test("nothing to read gives no stops", () => {
  expect(readAnimeStops("Vol 1", null)).toEqual([]);
  expect(readAnimeStops("Vol 1, Chap 1", "")).toEqual([]);
  expect(readAnimeStops(null, "Different throughout")).toEqual([]);
});

test("short season names are written out", () => {
  expect(seasonName("S2")).toBe("Season 2");
  expect(seasonName("S1P2 + OVA")).toBe("Season 1 part 2");
  expect(seasonName("S8 + More OVA")).toBe("Season 8");
  expect(seasonName("OVA 10 + Movie 3")).toBe("OVA 10 + Movie 3");
  expect(seasonName("S2P1 EP4")).toBe("Season 2 part 1 episode 4");
  expect(seasonName("Reze Movie")).toBe("Reze Movie");
});

test("only the furthest season of a finished manga can be its end", () => {
  // Bleach, as MangaUpdates has it: 74 volumes, and a latest chapter (250)
  // that's far short of the real one
  const bleach = readAnimeStops(
    "Vol 1, Chap 1 (Bleach) / Vol 55, Chap 480 (TYBW P1) / Vol 72, Chap 661 (TYBW P4)",
    "Vol 54, Chap 479 (Bleach) / Vol 61, Chap 542 (TYBW P1) / Vol 74, Chap 686 (TYBW P4)",
  );
  const manga = { finished: true, volumes: 74, lastChapter: 250 };
  expect(bleach.map((stop) => reachesTheEnd(stop, bleach, manga))).toEqual([
    false,
    false,
    true,
  ]);
  expect(bleach.map((stop) => stop.label)).toEqual([
    "Bleach",
    "Thousand-Year Blood War part 1",
    "Thousand-Year Blood War part 4",
  ]);
});

test("a wrong latest chapter doesn't end a manga early", () => {
  // Vampire Knight: 19 volumes, the anime stops in volume 10, and the
  // latest chapter on record is 1
  const stops = readAnimeStops(
    "Vol 1, Chap 1 (S1) / Vol 5, Chap 23 (S2)",
    "Vol 5, Chap 22 (S1) / Vol 10, Chap 46 (S2)",
  );
  const manga = { finished: true, volumes: 19, lastChapter: 1 };
  expect(stops.some((stop) => reachesTheEnd(stop, stops, manga))).toBe(false);
});

test("stopping at the last chapter, or a few past it, is the end", () => {
  const stops = readAnimeStops("Chap 1 (S1)", "Chap 73 (S1) / Chap 184 (S2)");
  const manga = { finished: true, volumes: null, lastChapter: 180 };
  expect(stops.map((stop) => reachesTheEnd(stop, stops, manga))).toEqual([
    false,
    true,
  ]);
  // still running: never the end
  const running = { ...manga, finished: false };
  expect(stops.some((stop) => reachesTheEnd(stop, stops, running))).toBe(false);
});

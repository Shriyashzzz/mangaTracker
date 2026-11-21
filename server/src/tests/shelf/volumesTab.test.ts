// The Volumes tab's rules: a row's bar laid out in runs (lib/ownedBar.ts),
// what to get in which order (lib/toGetLines.ts), and Buy next's one rule
// (lib/ownedVolumes.ts buyNextOf)

const volume = (n: number) => ({
  volume: n,
  isbn13: `978000000${String(n).padStart(4, "0")}`,
  title: `Vol. ${n}`,
  cheapest: null,
});

test("a row's bar: single volumes are one run, an edition's books then its singles", async () => {
  const { barRuns } = await import("../../../../client/src/lib/ownedBar.js");
  const singles = barRuns(5);
  expect(singles).toHaveLength(1);
  expect(singles[0]!.slots.map((s) => s.volumes)).toEqual([
    [1],
    [2],
    [3],
    [4],
    [5],
  ]);
  // Berserk Deluxe: books of three to vol. 42, then vol. 43 on its own
  const books = Array.from({ length: 14 }, (_, i) => [
    i * 3 + 1,
    i * 3 + 2,
    i * 3 + 3,
  ]);
  const mixed = barRuns(43, books);
  expect(mixed.map((r) => r.books)).toEqual([true, false]);
  expect(mixed[0]!.slots).toHaveLength(14);
  expect(mixed[1]!.slots.map((s) => s.volumes)).toEqual([[43]]);
  expect(barRuns(0)).toEqual([]);
});

test("to get: the next first, then the gaps; gaps first when they chose that", async () => {
  const { toGetLines } =
    await import("../../../../client/src/lib/toGetLines.js");
  // Haikyu!! owning 1–30 and 33–44: 31 and 32 are gaps, 45 is next
  const owned = [
    ...Array.from({ length: 30 }, (_, i) => i + 1),
    ...Array.from({ length: 12 }, (_, i) => i + 33),
  ];
  const missing = [volume(31), volume(32), volume(45)];
  const order = (lines: ReturnType<typeof toGetLines>) =>
    lines.map((l) =>
      l.kind === "one" ? l.volume.volume : `run ${l.volumes.length}`,
    );
  expect(order(toGetLines(missing, owned, false))).toEqual([45, 31, 32]);
  expect(order(toGetLines(missing, owned, true))).toEqual([31, 32, 45]);
});

test("to get: a long run of gaps is one line", async () => {
  const { toGetLines } =
    await import("../../../../client/src/lib/toGetLines.js");
  // Naruto owning 1–5 and 60–72: 6–59 missing
  const owned = [
    1,
    2,
    3,
    4,
    5,
    ...Array.from({ length: 13 }, (_, i) => i + 60),
  ];
  const missing = Array.from({ length: 54 }, (_, i) => volume(i + 6));
  const lines = toGetLines(missing, owned, false);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ kind: "run" });
  // a short gap stays volume by volume
  expect(toGetLines([volume(3), volume(4)], [1, 2, 5], false)).toHaveLength(2);
});

test("Buy next: the next after theirs, else their first gap; gaps first by choice", async () => {
  const { buyNextOf } =
    await import("../../../../client/src/lib/ownedVolumes.js");
  const out = Array.from({ length: 45 }, (_, i) => i + 1);
  const gappy = { volumesOwned: null, ownedList: [1, 2, 4, 5] };
  expect(buyNextOf(gappy, out, false)).toBe(6);
  expect(buyNextOf(gappy, out, true)).toBe(3);
  // owning the newest: the gap, never the newest they already have
  const toNewest = {
    volumesOwned: null,
    ownedList: out.filter((v) => v !== 31 && v !== 32),
  };
  expect(buyNextOf(toNewest, out, false)).toBe(31);
  // everything: nothing to buy
  expect(buyNextOf({ volumesOwned: 45 }, out, false)).toBeNull();
  // a gap with no book out isn't offered
  expect(
    buyNextOf(
      toNewest,
      out.filter((v) => v !== 31 && v !== 32),
      false,
    ),
  ).toBeNull();
});

// Which series the shelf looks covers up for (client/src/lib/coverMatch.ts)
import {
  MOST_PER_VISIT,
  RETRY_AFTER_MS,
  needingCovers,
  sameTitle,
} from "../../../../client/src/lib/coverMatch.js";

describe("sameTitle", () => {
  it("matches the same title written differently", () => {
    expect(
      sameTitle(
        "Frieren: Beyond Journey's End",
        "FRIEREN - Beyond Journey’s End",
      ),
    ).toBe(true);
    expect(sameTitle("Pokémon Adventures", "Pokemon Adventures")).toBe(true);
    expect(sameTitle("Wolf & Parchment", "Wolf and Parchment")).toBe(true);
  });

  it("keeps different series apart", () => {
    expect(sameTitle("Berserk", "Berserk of Gluttony")).toBe(false);
    expect(sameTitle("Monster", "Monster Musume")).toBe(false);
    expect(sameTitle("", "")).toBe(false);
  });
});

describe("needingCovers", () => {
  const m = (id: number, image: string | null) =>
    ({ id, image, name: `S${id}` }) as never;
  const now = 1_800_000_000_000;

  it("asks about ones with no cover, not tried this week", () => {
    const got = needingCovers(
      [m(1, null), m(2, "https://x/y.jpg"), m(3, null)],
      { 3: now - 1000 },
      now,
    );
    expect(got.map((x: { id: number }) => x.id)).toEqual([1]);
  });

  it("asks again after a week, and a visit's worth at most", () => {
    expect(
      needingCovers([m(1, null)], { 1: now - RETRY_AFTER_MS }, now),
    ).toHaveLength(1);
    const many = Array.from({ length: 100 }, (_, i) => m(i + 1, null));
    expect(needingCovers(many, {}, now)).toHaveLength(MOST_PER_VISIT);
  });
});

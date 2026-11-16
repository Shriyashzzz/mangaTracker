// The volume a season's next chapter is in, from the saved volume starts,
// when MangaUpdates doesn't say (prices/afterAnime/nextVolume.ts)
import { withNextVolumes } from "../../prices/afterAnime/nextVolume.js";

// Vinland Saga: vol. 14 starts at chapter 94, vol. 15 at 101, vol. 16 at 108
const starts = [
  { volume: 14, firstChapter: 94 },
  { volume: 15, firstChapter: 101 },
  { volume: 16, firstChapter: 108 },
];
const season2 = {
  label: "Season 2",
  endVolume: 14,
  endChapter: 100,
  endsMidChapter: false,
  nextChapter: 101,
  nextVolume: null,
  note: "",
  corrected: false,
};

test("the next chapter's volume comes from where the volumes start", () => {
  expect(withNextVolumes([season2], starts)[0]!.nextVolume).toBe(15);
});

test("only an answer that agrees with where the season ends is taken", () => {
  // MangaUpdates says it ends in vol. 10: these starts number it otherwise
  expect(
    withNextVolumes([{ ...season2, endVolume: 10 }], starts)[0]!.nextVolume,
  ).toBeNull();
  // nothing saved: the safe pick stays
  expect(withNextVolumes([season2], [])[0]!.nextVolume).toBeNull();
  // MangaUpdates' own answer, or a reader's fix, is never replaced
  expect(
    withNextVolumes([{ ...season2, nextVolume: 14 }], starts)[0]!.nextVolume,
  ).toBe(14);
});

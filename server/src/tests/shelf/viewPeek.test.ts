// When Kenji asks about compact rows (client/src/lib/viewPeek.ts)
import {
  ASK_AGAIN_AFTER_MS,
  canAskAboutView,
  readViewPeek,
} from "../../../../client/src/lib/viewPeek.js";

const now = 1_800_000_000_000;
const shelf = { series: 20, rows: false, now };

describe("canAskAboutView", () => {
  it("asks someone on big covers with 20 series who hasn't been asked", () => {
    expect(canAskAboutView({}, shelf)).toBe(true);
  });

  it("waits for 20 series", () => {
    expect(canAskAboutView({}, { ...shelf, series: 19 })).toBe(false);
  });

  it("never asks someone already on rows", () => {
    expect(canAskAboutView({}, { ...shelf, rows: true })).toBe(false);
  });

  it("asks again 2 days after being ignored, not sooner", () => {
    const justUnder = { lastShownAt: now - ASK_AGAIN_AFTER_MS + 1 };
    const twoDays = { lastShownAt: now - ASK_AGAIN_AFTER_MS };
    expect(canAskAboutView(justUnder, shelf)).toBe(false);
    expect(canAskAboutView(twoDays, shelf)).toBe(true);
  });

  it("stops for good once they've tried it or closed him", () => {
    expect(canAskAboutView({ done: true, lastShownAt: 0 }, shelf)).toBe(false);
  });
});

describe("readViewPeek", () => {
  it("treats nothing saved, or something broken, as never asked", () => {
    expect(readViewPeek(null)).toEqual({});
    expect(readViewPeek("{oops")).toEqual({});
    expect(readViewPeek("null")).toEqual({});
    expect(readViewPeek('{"done":true}')).toEqual({ done: true });
  });
});

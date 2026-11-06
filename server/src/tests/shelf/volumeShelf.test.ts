// The details page's shelf of volumes (client/src/lib/volumeShelf.ts)
import {
  BOOK,
  aimAt,
  bookAt,
  bookWidths,
  toggled,
} from "../../../../client/src/lib/volumeShelf.js";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("bookWidths", () => {
  it("fills the shelf evenly when resting", () => {
    const w = bookWidths(113, 460, null);
    expect(w).toHaveLength(113);
    expect(sum(w)).toBeCloseTo(460);
  });

  it("never makes a book wider than full size", () => {
    expect(bookWidths(5, 460, null)).toEqual(Array(5).fill(BOOK));
    expect(Math.max(...bookWidths(113, 460, 40.5))).toBeLessThanOrEqual(BOOK);
  });

  it("fills the shelf exactly while magnifying too, so the ends never leave it", () => {
    for (const aimed of [0.2, 5.5, 56.5, 112.8]) {
      expect(sum(bookWidths(113, 460, aimed))).toBeCloseTo(460);
      expect(sum(bookWidths(999, 339, aimed))).toBeCloseTo(339);
    }
  });

  it("grows the aimed book to full size, its neighbours less", () => {
    const w = bookWidths(113, 460, 5.5);
    expect(w[5]).toBeCloseTo(BOOK); // vol. 6
    expect(w[4]!).toBeLessThan(BOOK);
    expect(w[4]!).toBeGreaterThan(w[0]!);
  });
});

describe("the aimed book stays under the pointer", () => {
  // every position along the shelf, for a long series, a very long one, and
  // a phone's narrower shelf
  for (const [total, width] of [
    [113, 460],
    [300, 460],
    [113, 339],
    [999, 339],
  ] as const) {
    it(`${total} volumes on a ${width}px shelf`, () => {
      for (let x = 0.5; x < width; x += 3.7) {
        const aimed = aimAt(x, total, width);
        const w = bookWidths(total, width, aimed);
        expect(bookAt(w, x)).toBe(Math.floor(aimed) + 1);
        // big enough to read and tap, wherever on it the pointer is
        expect(w[Math.floor(aimed)]!).toBeGreaterThan(18);
      }
    });
  }

  it("pointing where a volume sits at rest magnifies that volume", () => {
    for (const [total, width] of [
      [113, 460],
      [113, 339],
      [300, 460],
    ] as const) {
      const rest = width / total;
      for (const v of [1, 2, 6, 25, Math.round(total / 2), total - 5, total]) {
        const x = (v - 0.5) * rest;
        const w = bookWidths(total, width, aimAt(x, total, width));
        expect(bookAt(w, x)).toBe(v);
      }
    }
  });

  it("a short series doesn't magnify", () => {
    const w = bookWidths(19, 460, 4.5);
    expect(w).toEqual(Array(19).fill(BOOK));
    expect(bookAt(w, 4.5 * BOOK)).toBe(5);
  });
});

describe("toggled", () => {
  it("adds in order and takes away", () => {
    expect(toggled([1, 2, 5], 3)).toEqual([1, 2, 3, 5]);
    expect(toggled([1, 2, 5], 2)).toEqual([1, 5]);
  });

  it("keeps halves and specials it doesn't show", () => {
    expect(toggled([0, 1, 10.5], 2)).toEqual([0, 1, 2, 10.5]);
  });
});

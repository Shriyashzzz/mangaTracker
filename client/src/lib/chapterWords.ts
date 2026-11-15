// How a volume and a chapter are said together, for someone reading by the
// chapter with no books, so it's plain why that book is next: the buy box's
// "Vol. 5" over "ch. 34–42", the New card's "Read up to ch. 38 · vol. 5 has
// ch. 34–42" (the newest volume, whose end isn't known yet: "ch. 213 on").
// Pure, so the server's tests can load it.

export type ChapterRange = { from: number; to: number | null };

// "ch. 34–42", "ch. 213 on"
export const chaptersText = (range: ChapterRange) =>
  range.to == null ? `ch. ${range.from} on` : `ch. ${range.from}–${range.to}`;

// reading by the chapter, with no books and no volume read: their place is a
// chapter, so a card says it in chapters
export const readsByChapterOnly = (m: {
  bookmark: number | null;
  volumesOwned: number | null;
  readVolume?: number | null;
  ownedList?: number[] | null;
}) =>
  Boolean(m.bookmark) &&
  !m.volumesOwned &&
  !m.readVolume &&
  !m.ownedList?.length;

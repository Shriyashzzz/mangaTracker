// A backup, written and read back: everything the shelf keeps about a series
// has to survive the trip, the newer fields too (the volume read, how it's
// tracked, the books with their ISBNs and what was paid, the edition
// collected). Uses the app's own export and import code.
import { shelfToCsv } from "../../../../client/src/lib/shelfCsv.js";
import {
  groupBooks,
  parseCsv,
  readBooks,
  toEntry,
} from "../../../../client/src/lib/imports/bookImport.js";
import type { Manga } from "../../../../client/src/lib/types.js";
import { toMangaInput } from "../../util/shelf/malEntry.js";

const manga = (id: number, over: Partial<Manga>): Manga => ({
  id,
  userId: 1,
  name: `Series ${id}`,
  genre: null,
  description: null,
  image: null,
  status: false,
  planned: false,
  bookmark: 0,
  volumesOwned: null,
  rating: null,
  ...over,
});

test("a backup read back keeps the volume read, the books and the edition", () => {
  const shelf = [
    manga(1, {
      name: "Berserk",
      byVolume: true,
      readVolume: 4,
      volumesOwned: 7,
      ownedList: [],
      edition: "deluxe",
      genre: "Action",
      rating: 5,
    }),
    manga(2, { name: "One Piece", bookmark: 1100, volumesOwned: 3 }),
  ];
  const csv = shelfToCsv(shelf, {
    1: [
      {
        isbn13: "9781506711980",
        edition: "deluxe",
        number: 1,
        title: "Berserk Deluxe Volume 1",
        volumes: [1, 2, 3],
        paidCents: 4999,
        boughtOn: "2026-01-05T00:00:00.000Z",
      },
      {
        isbn13: null,
        edition: "single",
        number: 7,
        title: null,
        volumes: [7],
      },
    ],
  });
  const series = groupBooks(readBooks(parseCsv(csv), "csv"));
  const entries = series.map((s) => toEntry(s));
  const berserk = entries.find((e) => e.title === "Berserk")!;
  expect(berserk).toMatchObject({
    restore: true,
    byVolume: true,
    readVolumes: 4,
    ownedVolumes: 7,
    edition: "deluxe",
    genre: "Action",
    score: 10,
    books: [
      {
        isbn13: "9781506711980",
        edition: "deluxe",
        number: 1,
        volumes: [1, 2, 3],
        paidCents: 4999,
        boughtOn: "2026-01-05",
      },
      { isbn13: null, edition: "single", number: 7, volumes: [7] },
    ],
  });
  // and as the shelf saves it: read up to 4, owning 7, never the other way
  expect(toMangaInput(berserk as never, null)).toMatchObject({
    byVolume: true,
    readVolume: 4,
    volumesOwned: 7,
    edition: "deluxe",
  });
  // a series with none of the new fields is as it was
  const onePiece = entries.find((e) => e.title === "One Piece")!;
  expect(onePiece).toMatchObject({ chapters: 1100, ownedVolumes: 3 });
  expect(onePiece).not.toHaveProperty("books");
  expect(onePiece).not.toHaveProperty("edition");
  expect(onePiece.byVolume).toBe(false);
});

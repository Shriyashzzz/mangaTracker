// A general reader's Goodreads: the novels AniList has a manga of by the same
// name (Madame Bovary, The Long Goodbye) are known by their publisher and left
// unticked; collectors' manga, from Del Rey or co-published, never are
import {
  groupBooks,
  parseCsv,
  readBooks,
} from "../../../../client/src/lib/imports/bookImport.js";
import { novelPublisherOf } from "../../../../client/src/lib/imports/novelPublisher.js";

const goodreads = (rows: [title: string, publisher: string][]) =>
  groupBooks(
    readBooks(
      parseCsv(
        [
          "Book Id,Title,Publisher,Exclusive Shelf,Owned Copies,My Rating,Read Count,Bookshelves",
          ...rows.map(([t, p], i) => `${i},"${t}","${p}",read,1,0,1,`),
        ].join("\n"),
      ),
      "goodreads",
    ),
  );

test("novels from a general reader's library are known by their publisher", () => {
  const series = goodreads([
    ["Madame Bovary", "Oxford University Press"],
    [
      "The Adventures of Sherlock Holmes (Sherlock Holmes, #3)",
      "Oxford University Press",
    ],
    ["The Hound of the Baskervilles (Sherlock Holmes, #5)", "Signet"],
    ["The Long Goodbye", "Vintage Crime/Black Lizard"],
    ["Agency (Jackpot #2)", "Berkley"],
    ["No Longer Human", "New Directions"],
    ["Dracula", "Norton"],
  ]);
  for (const s of series) expect(s.novelPublisher).toBeTruthy();
  expect(series.find((s) => s.title === "Madame Bovary")?.novelPublisher).toBe(
    "Oxford University Press",
  );
});

test("collectors' manga are never taken for novels", () => {
  const series = goodreads([
    ["xxxHolic, Vol. 4", "Del Rey Books"],
    ["Tsubasa: RESERVoir CHRoNiCLE, Vol. 6", "Ballantine Books"],
    [
      "The Dark-Hunters, Vol. 1 (Dark-Hunter Manga, #1)",
      "St. Martin's Griffin",
    ],
    ["Inukami! Vol. 1 (Inukami!, #1)", "Tor/Seven Seas"],
    ["A Bride's Story, Vol. 3 (A Bride's Story, #3)", "Orbit/Yen Press"],
    ["Daniel X: The Manga, Vol. 2", "Orbit"],
    ["One Piece, Vol. 112", "VIZ Media LLC"],
    ["Inuyashiki, Vol. 1", "Kodansha Comics"],
    ["Fairy Tail, Vol. 01", "Random House"],
    ["Nichijou, Vol. 1", ""],
  ]);
  for (const s of series) expect(s.novelPublisher).toBeUndefined();
});

test("a series is the novel only when every book of it is", () => {
  const [s] = goodreads([
    ["Berserk, Vol. 1", "Dark Horse"],
    ["Berserk, Vol. 2", "Bantam"],
  ]);
  expect(s!.novelPublisher).toBeUndefined();
  expect(novelPublisherOf("Under the Dome", "Gallery Books")).toBe(
    "Gallery Books",
  );
  expect(novelPublisherOf("Tor", "Tor/Seven Seas")).toBeNull();
});

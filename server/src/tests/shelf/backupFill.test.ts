import { backupFill, type MalEntry } from "../../util/shelf/malEntry.js";

const entry = (over: Partial<MalEntry>): MalEntry => ({
  title: "One Piece",
  finished: false,
  chapters: 0,
  readVolumes: 0,
  ownedVolumes: 0,
  score: 0,
  ...over,
});
const had = {
  bookmark: 100,
  status: false,
  planned: false,
  rating: null,
  description: null,
};

test("a backup fills what the shelf lacks and never undoes newer reading", () => {
  // further along, rated, with notes: all taken
  expect(
    backupFill(entry({ chapters: 120, score: 8, comments: " box set " }), had),
  ).toEqual({ bookmark: 120, rating: 4, description: "box set" });
  // an older backup: the shelf's chapter, rating and notes stay
  expect(
    backupFill(entry({ chapters: 50, score: 6, comments: "old" }), {
      ...had,
      rating: 5,
      description: "mine",
    }),
  ).toBeNull();
  // finished in the backup finishes it; a chapter takes it off To read
  expect(backupFill(entry({ finished: true }), had)).toEqual({
    status: true,
    planned: false,
  });
  expect(
    backupFill(entry({ chapters: 3 }), {
      ...had,
      bookmark: null,
      planned: true,
    }),
  ).toEqual({ bookmark: 3, planned: false });
});

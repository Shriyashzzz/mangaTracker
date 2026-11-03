import { READER_NAMES } from "../util/readerNames.js";
import { toSharedShelf } from "../util/sharedShelf.js";

const source = {
  id: 3,
  displayName: "Ink Goblin",
  avatar: "ink",
  shareNotes: false,
  // everything the database could hold, to prove it doesn't come through
  username: "secret_login",
  recoveryEmail: "me@example.com",
  manga: [
    {
      name: "Berserk",
      image: null,
      genre: "Action",
      status: false,
      planned: false,
      bookmark: 12,
      rating: 5,
      description: "my private thoughts",
      volumesOwned: 3,
      seenVolume: 2,
    },
  ],
};

test("a shared list never gives away the login or the email", () => {
  const text = JSON.stringify(toSharedShelf(source));
  expect(text).not.toContain("secret_login");
  expect(text).not.toContain("me@example.com");
  expect(text).not.toContain("volumesOwned");
  expect(text).not.toContain("seenVolume");
});

test("notes stay private unless they choose to share them", () => {
  expect(JSON.stringify(toSharedShelf(source))).not.toContain("private thoughts");
  const shared = toSharedShelf({ ...source, shareNotes: true });
  expect(shared.manga[0]).toMatchObject({ notes: "my private thoughts" });
});

test("no display name means a fun stand-in that stays the same, never the username", () => {
  const first = toSharedShelf({ ...source, displayName: null }).displayName;
  expect(READER_NAMES).toContain(first);
  expect(toSharedShelf({ ...source, displayName: null }).displayName).toBe(first);
  expect(READER_NAMES.every((name) => name.length <= 40)).toBe(true);
});

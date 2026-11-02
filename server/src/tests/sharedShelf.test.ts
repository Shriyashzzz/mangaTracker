import { toSharedShelf } from "../util/sharedShelf.js";

const source = {
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

test("no display name means a stand-in, not the username", () => {
  expect(toSharedShelf({ ...source, displayName: null }).displayName).toBe("A reader");
});

import { READER_NAMES } from "../../util/shelf/readerNames.js";
import { toSharedShelf } from "../../util/shelf/sharedShelf.js";
import { volumeFacts } from "../../util/shelf/sharedVolumes.js";
import { validShareTop } from "../../util/shelf/shareTop.js";

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
  expect(text).not.toContain("seenVolume");
});

test("the volumes they own are shown, as on their shelf", () => {
  expect(toSharedShelf(source).manga[0]).toMatchObject({ volumesOwned: 3 });
  expect(toSharedShelf(source).manga[0]).not.toHaveProperty("ownedList");
  const gaps = toSharedShelf({
    ...source,
    manga: [{ ...source.manga[0]!, volumesOwned: 7, ownedList: [1, 4, 7] }],
  });
  expect(gaps.manga[0]).toMatchObject({
    volumesOwned: 7,
    ownedList: [1, 4, 7],
  });
});

test("notes stay private unless they choose to share them", () => {
  expect(JSON.stringify(toSharedShelf(source))).not.toContain(
    "private thoughts",
  );
  const shared = toSharedShelf({ ...source, shareNotes: true });
  expect(shared.manga[0]).toMatchObject({ notes: "my private thoughts" });
});

test("no display name means a fun stand-in that stays the same, never the username", () => {
  const first = toSharedShelf({ ...source, displayName: null }).displayName;
  expect(READER_NAMES).toContain(first);
  expect(toSharedShelf({ ...source, displayName: null }).displayName).toBe(
    first,
  );
  expect(READER_NAMES.every((name) => name.length <= 40)).toBe(true);
});

// ---------- what the catalog adds: the next volume, and "has them all" ----------

const book = (volume: number, published?: string) => ({
  volume,
  isbn13: `97800000000${String(volume).padStart(2, "0")}`,
  title: `Berserk, Vol. ${volume}`,
  published,
});
const NOW = new Date("2026-11-14T12:00:00Z");

test("the next volume to get is the one right after their highest", () => {
  const listed = [book(1), book(2), book(3), book(4, "2027-02-09")];
  expect(volumeFacts([1, 2], listed, NOW).next).toEqual({
    volume: 3,
    isbn13: "9780000000003",
    title: "Berserk, Vol. 3",
    comingOut: null,
  });
  // not out yet: still the next one, with its date
  expect(volumeFacts([1, 2, 3], listed, NOW).next?.comingOut).toBe(
    "2027-02-09",
  );
  // gaps lower down don't change it: it goes by their highest
  expect(volumeFacts([1, 3], listed, NOW).next?.volume).toBe(4);
  // a hole in the catalog where the next one should be: none, rather than
  // naming a later volume
  expect(volumeFacts([1], [book(1), book(3)], NOW).next).toBeNull();
  // owns nothing, or the catalog doesn't know the series: none
  expect(volumeFacts([], listed, NOW).next).toBeNull();
  expect(volumeFacts([1, 2], [], NOW)).toEqual({ next: null, ownsAll: false });
});

test("having them all means every volume that's out, with no gaps", () => {
  const listed = [book(1), book(2), book(3), book(4, "2027-02-09")];
  expect(volumeFacts([1, 2, 3], listed, NOW).ownsAll).toBe(true);
  expect(volumeFacts([1, 3], listed, NOW).ownsAll).toBe(false);
  expect(volumeFacts([1, 2], listed, NOW).ownsAll).toBe(false);
});

test("a shared series carries its next volume, and nothing else new", () => {
  const next = {
    volume: 4,
    isbn13: "9780000000004",
    title: "Berserk, Vol. 4",
    comingOut: null,
  };
  // (as the database hands it over, with the edition they collect)
  const collected = { ...source.manga[0]!, edition: "deluxe" };
  const shared = toSharedShelf({
    ...source,
    manga: [collected],
    facts: [{ next, ownsAll: true }],
  }).manga[0]!;
  expect(shared).toMatchObject({ next, ownsAll: true });
  // the edition they collect is only read to work this out
  expect(shared).not.toHaveProperty("edition");
  // none when the catalog doesn't know the series
  expect(toSharedShelf(source).manga[0]).not.toHaveProperty("next");
});

// ---------- the series they put at the top ----------

test("up to five different names can be put at the top", () => {
  expect(validShareTop(["Berserk", "Monster"])).toEqual(["Berserk", "Monster"]);
  // an empty list clears them
  expect(validShareTop([])).toEqual([]);
  for (const bad of [
    undefined,
    "Berserk",
    ["a", "b", "c", "d", "e", "f"],
    ["Berserk", "Berserk"],
    ["Berserk", 7],
    ["  "],
    ["x".repeat(151)],
  ])
    expect(validShareTop(bad)).toBeNull();
});

test("a shared shelf leads with their picks that are still on it", () => {
  const shelf = toSharedShelf({
    ...source,
    prefs: { shareTop: ["Gone since", "Berserk"] },
  });
  expect(shelf.top).toEqual(["Berserk"]);
  expect(toSharedShelf(source).top).toEqual([]);
});

// ---------- what the owner chooses to show ----------

test("ratings and reading progress are shown unless switched off", () => {
  const shown = toSharedShelf(source).manga[0]!;
  expect(shown).toMatchObject({ rating: 5, bookmark: 12 });
  const hidden = toSharedShelf({
    ...source,
    shareRatings: false,
    shareProgress: false,
  }).manga[0]!;
  expect(hidden.rating).toBeNull();
  expect(hidden.bookmark).toBeNull();
  expect(hidden).not.toHaveProperty("readVolume");
  // what they own is still shown: that's the shelf
  expect(hidden).toMatchObject({ volumesOwned: 3 });
});

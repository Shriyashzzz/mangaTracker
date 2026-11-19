// The shelf's dated history, written by the database itself
// (migration 20261209000000_shelf_history), with a real database
import mangaQueries from "../../models/mangaQueries.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

beforeEach(emptyDb);
afterAll(closeDb);

const reader = async () =>
  (await userQueries.addUser("reader", "a long password"))!;
const events = (userId: number) =>
  prisma.shelfEvent.findMany({
    where: { userId },
    orderBy: { id: "asc" },
    select: { kind: true, volume: true, amount: true, series: true },
  });

test("adding a series, ticking volumes, reading and finishing are recorded", async () => {
  const userId = await reader();
  const id = await mangaQueries.addManga(userId, {
    name: "Blue Box",
    status: false,
    volumesOwned: 2,
    bookmark: 10,
  });
  // vol. 3 ticked, then a list with a gap: 2 taken off
  await mangaQueries.setVolumesOwned(id, { volumesOwned: 3, ownedList: [] });
  await mangaQueries.setVolumesOwned(id, {
    volumesOwned: 3,
    ownedList: [1, 3],
  });
  await mangaQueries.setBookmark(id, 25);
  // a slip, put right: it nets out
  await mangaQueries.setBookmark(id, 20);
  const manga = (await mangaQueries.getManga(id))!;
  await mangaQueries.setReading(manga, { readVolume: 2 });
  await mangaQueries.setStatus(id, true);

  expect(await events(userId)).toEqual([
    { kind: "added", volume: null, amount: 2, series: "Blue Box" },
    { kind: "owned", volume: 3, amount: 1, series: "Blue Box" },
    { kind: "owned", volume: 2, amount: -1, series: "Blue Box" },
    { kind: "chapters", volume: 25, amount: 15, series: "Blue Box" },
    { kind: "chapters", volume: 20, amount: -5, series: "Blue Box" },
    { kind: "volumes", volume: 2, amount: 2, series: "Blue Box" },
    { kind: "finished", volume: null, amount: 1, series: "Blue Box" },
  ]);
});

test("a rating or notes change writes nothing", async () => {
  const userId = await reader();
  const id = await mangaQueries.addManga(userId, {
    name: "Dandadan",
    status: false,
  });
  await mangaQueries.setRating(id, 5);
  await mangaQueries.setNotes(id, "great");
  expect((await events(userId)).map((e) => e.kind)).toEqual(["added"]);
});

test("an import is marked imported; an undo writes nothing", async () => {
  const userId = await reader();
  await mangaQueries.addManyManga(
    userId,
    [
      { name: "Berserk", status: false, volumesOwned: 41 },
      { name: "Vagabond", status: false, volumesOwned: 37 },
    ],
    { from: "import" },
  );
  await mangaQueries.addManyManga(userId, [{ name: "Naruto", status: false }], {
    from: "undo",
  });
  expect(await events(userId)).toEqual([
    { kind: "imported", volume: null, amount: 41, series: "Berserk" },
    { kind: "imported", volume: null, amount: 37, series: "Vagabond" },
  ]);
});

test("a deleted series keeps its history; the account's goes with it", async () => {
  const userId = await reader();
  const id = await mangaQueries.addManga(userId, {
    name: "Haikyu!!",
    status: false,
  });
  await mangaQueries.deleteManga(id);
  const kept = await prisma.shelfEvent.findMany({ where: { userId } });
  expect(kept).toHaveLength(1);
  expect(kept[0]).toMatchObject({ mangaId: null, series: "Haikyu!!" });
  await prisma.user.delete({ where: { id: userId } });
  expect(await prisma.shelfEvent.count()).toBe(0);
});

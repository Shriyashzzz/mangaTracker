// The picture a shared shelf's link shows (util/shelf/shelfCard.ts)
import sharp from "sharp";
import { MOST_COVERS, shelfCard } from "../../util/shelf/shelfCard.js";

// a plain picture standing in for a cover
const cover = (color: string) =>
  sharp({ create: { width: 230, height: 345, channels: 3, background: color } })
    .jpeg()
    .toBuffer();

test("the card is a link-preview sized JPEG of the covers", async () => {
  const card = await shelfCard([
    await cover("#b14a3c"),
    await cover("#1d1a16"),
    await cover("#cdd6fb"),
  ]);
  expect(await sharp(card!).metadata()).toMatchObject({
    format: "jpeg",
    width: 1200,
    height: 630,
  });
});

test("more covers than fit are left off, and a broken one is skipped", async () => {
  const many = await Promise.all(
    Array.from({ length: MOST_COVERS + 3 }, () => cover("#b14a3c")),
  );
  expect(await shelfCard(many)).not.toBeNull();
  expect(
    await shelfCard([Buffer.from("not a picture"), await cover("#1d1a16")]),
  ).not.toBeNull();
});

test("with no cover to draw there's no card", async () => {
  expect(await shelfCard([])).toBeNull();
  expect(await shelfCard([Buffer.from("not a picture")])).toBeNull();
});

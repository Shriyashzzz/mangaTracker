// Covers resized for the page (prices/sources/coverResizer.ts), and the
// addresses they're resized from (prices/sources/covers.ts)
import sharp from "sharp";
import { COVER_WIDTHS as CLIENT_WIDTHS } from "../../../../client/src/lib/coverSizes.js";
import {
  COVER_WIDTHS,
  allowedWidth,
  resizeCover,
} from "../../prices/sources/coverResizer.js";
import { anilistSources, googleCoverAt } from "../../prices/sources/covers.js";

// a plain picture of that size, as a JPEG
const picture = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: "#b14a3c" },
  })
    .jpeg()
    .toBuffer();

test("the page and the server agree on the widths", () => {
  expect([...CLIENT_WIDTHS]).toEqual([...COVER_WIDTHS]);
});

test("a width asked for is rounded up to one we make", () => {
  expect(allowedWidth("120")).toBe(120);
  expect(allowedWidth("170")).toBe(220);
  expect(allowedWidth("331")).toBe(480);
  // wider than any: the widest
  expect(allowedWidth("5000")).toBe(480);
  // no width, or nonsense: none, and the cover goes out as it came
  for (const none of [undefined, "", "abc", "0", "-5"])
    expect(allowedWidth(none)).toBeNull();
});

test("a cover is resized to the width, as WebP, and never enlarged", async () => {
  const resized = await resizeCover(await picture(600, 900), 330);
  expect(await sharp(resized).metadata()).toMatchObject({
    format: "webp",
    width: 330,
    height: 495,
  });
  // a 300px scan asked for at 480 stays 300
  const small = await resizeCover(await picture(300, 450), 480);
  expect((await sharp(small).metadata()).width).toBe(300);
});

test("something that isn't a picture can't be resized", async () => {
  await expect(resizeCover(Buffer.from("<html>"), 330)).rejects.toThrow();
});

test("only AniList's own cover addresses are fetched for a series cover", () => {
  const cover = (size: string) =>
    `https://s4.anilist.co/file/anilistcdn/media/manga/cover/${size}/bx30013-abc.jpg`;
  // its medium when that's wide enough
  expect(anilistSources(cover("medium"), 220)).toEqual([cover("medium")]);
  // its large for anything wider, then the saved size: an older cover has
  // no large at all
  expect(anilistSources(cover("medium"), 330)).toEqual([
    cover("large"),
    cover("medium"),
  ]);
  expect(anilistSources(cover("small"), 120)).toEqual([
    cover("medium"),
    cover("small"),
  ]);
  for (const other of [
    "https://example.com/a.jpg",
    "https://s4.anilist.co.evil.example/file/anilistcdn/media/manga/cover/medium/a.jpg",
    "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/../../secret",
    "http://localhost:8080/api/prefs",
  ])
    expect(anilistSources(other, 220)).toEqual([]);
});

test("a saved Google cover can be had at another width", () => {
  const saved =
    "https://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1&fife=w400-h600";
  expect(googleCoverAt(saved, 480)).toContain("fife=w480-h720");
  expect(googleCoverAt(saved, 480)).not.toContain("w400");
  // an address saved without a size gets one
  expect(
    googleCoverAt("https://books.google.com/books/content?id=x", 480),
  ).toBe("https://books.google.com/books/content?id=x&fife=w480-h720");
});

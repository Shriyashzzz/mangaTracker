// Covers resized for the page (prices/sources/coverResizer.ts), and the
// addresses they're resized from (prices/sources/covers.ts)
import sharp from "sharp";
import {
  COVER_WIDTHS as CLIENT_WIDTHS,
  coverChoices,
  isOwnPick,
} from "../../../../client/src/lib/coverSizes.js";
import {
  COVER_WIDTHS,
  allowedWidth,
  isBlankPage,
  isCoverShaped,
  resizeCover,
} from "../../prices/sources/coverResizer.js";
import { firstVolumeIsbn } from "../../prices/sources/englishCover.js";
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

// ---------- a series' cover: the English one first ----------

const ANILIST_COVER =
  "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30013-abc.jpg";
const book = (volume: number | null, isbn13: string, extra = {}) => ({
  isbn13,
  title: `One Piece, Vol. ${volume}`,
  authors: null,
  publisher: null,
  year: null,
  volume,
  coverUrl: "",
  ...extra,
});

test("a series' English cover is its first volume's, never an omnibus's", () => {
  expect(
    firstVolumeIsbn([
      // a 3-in-1 holding vols 1 to 3 is listed as vol. 1 too
      book(1, "9781421536255", { inBook: { book: 1, from: 1, to: 3 } }),
      book(2, "9781569319024"),
      book(1, "9781569319017 "),
    ]),
  ).toBe("9781569319017");
  // no vol. 1 saved: none, and the Japanese cover is shown
  expect(firstVolumeIsbn([book(2, "9781569319024")])).toBeNull();
  expect(firstVolumeIsbn([])).toBeNull();
});

test("a store's square no-image picture isn't taken for a cover", async () => {
  expect(await isCoverShaped(await picture(300, 450))).toBe(true);
  expect(await isCoverShaped(await picture(300, 300))).toBe(false);
  expect(await isCoverShaped(await picture(450, 300))).toBe(false);
});

test("a series' cover is asked for by name, so the English one can be sent", () => {
  const first = coverChoices(ANILIST_COVER, { name: "One Piece" })[0]!.url;
  expect(first).toBe(
    `/api/prices/cover/series?name=One+Piece&u=${encodeURIComponent(ANILIST_COVER)}&w=120`,
  );
  // In Japan asks for the Japanese one first
  expect(
    coverChoices(ANILIST_COVER, { name: "One Piece", japanFirst: true })[0]!
      .url,
  ).toContain("&first=japan&w=120");
  // no cover saved with it: still asked for by name
  expect(coverChoices(null, { name: "One Piece" })[0]!.url).toBe(
    "/api/prices/cover/series?name=One+Piece&w=120",
  );
  // a link the reader pasted is theirs: shown as it is
  expect(
    coverChoices("https://example.com/mine.jpg", { name: "One Piece" }),
  ).toEqual([{ url: "https://example.com/mine.jpg", width: 0 }]);
  expect(isOwnPick("https://example.com/mine.jpg")).toBe(true);
  expect(isOwnPick(ANILIST_COVER)).toBe(false);
  // a volume's own cover is already the English one
  expect(
    coverChoices("/api/prices/cover/9781569319017", { name: "One Piece" })[0]!
      .url,
  ).toBe("/api/prices/cover/9781569319017?w=120");
  // nothing to ask for at all
  expect(coverChoices(null)).toEqual([]);
});

test("a blank white page is not a cover; a cover with white on it is", async () => {
  const white = (overlay?: { input: Buffer; top: number; left: number }) =>
    sharp({
      create: { width: 300, height: 450, channels: 3, background: "#ffffff" },
    })
      .composite(overlay ? [overlay] : [])
      .jpeg()
      .toBuffer();
  // Google's empty first page: white all over
  expect(await isBlankPage(await white())).toBe(true);
  // a mostly white cover with art on it
  const art = await sharp({
    create: { width: 200, height: 200, channels: 3, background: "#1d1a16" },
  })
    .png()
    .toBuffer();
  expect(
    await isBlankPage(await white({ input: art, top: 60, left: 50 })),
  ).toBe(false);
  // and any ordinary picture
  expect(await isBlankPage(await picture(300, 450))).toBe(false);
});

// A picture of a shelf for its owner to save and post: its name, the shelf
// in numbers, its genres as stamps and a few covers fanned out on dotted
// paper (a different colour each time), 1080 by 1350 (a portrait post), or
// the same on a 1080 by 1920 page (a phone's story).
// Drawn in the browser on a canvas, so the lettering is in the site's own
// faces (which the page has already loaded)
// and the server needs no fonts.
//
// The link's own preview picture is a different one, made by the server
// (server util/shelf/shelfCard.ts): wide, covers only.
import type { GenreShare } from "./shelfNumbers";
import {
  ACCENT,
  CARD,
  drawPaper,
  fitText,
  INK,
  loadPictureCover,
  pictureOf,
} from "../../lib/picture";

const WIDTH = 1080;
const HEIGHT = 1350;
// the paper is a different colour each time: one of the site's stamp inks
const PAPERS = ["#f8d46b", "#bfe6c8", "#cdd6fb", "#f2c9bf", "#f3eee2"];
const pick = <T>(from: readonly T[]) =>
  from[Math.floor(Math.random() * from.length)]!;
// The genres are stamps, the biggest first, two to a row: what each is
// inked in and lettered in, how big its letters are, how far it's tilted,
// and which row it's on
const STAMPS = [
  { ink: ACCENT, letters: CARD, size: 74, tilt: -4, row: 0 },
  { ink: INK, letters: CARD, size: 62, tilt: 3, row: 0 },
  { ink: CARD, letters: INK, size: 52, tilt: 2, row: 1 },
  { ink: INK, letters: CARD, size: 46, tilt: -3, row: 1 },
];
// where each row of stamps sits, by its middle
const STAMP_ROWS = [392, 492];
// "Other" isn't a genre to brag about
const STAMPED = STAMPS.length;
// a cover on the picture, and how far each is tilted, left to right
const COVER_W = 300;
const COVER_H = 450;
const TILTS = [-8, 5, -3, 7, -5];
export const MOST_COVERS = TILTS.length;
// where the row of covers sits, by its middle: under the stamps
const COVERS_MIDDLE = 815;
// the cover asked for: the width the server makes that's just wide enough
const COVER_ASKED = 330;

export type ShelfPicture = {
  name: string;
  // "84 series · 373 volumes owned"
  tally: string;
  // how the shelf splits by genre, biggest first (shelfNumbers.ts); empty
  // when there's too little to say
  genres: GenreShare[];
  // the covers' addresses, the first at the left
  covers: string[];
};

const loadCover = (url: string) => loadPictureCover(url, COVER_ASKED);

// the covers in a row across the middle, each overlapping the one before,
// tilted, edged in ink with a hard shadow
function drawCovers(ctx: CanvasRenderingContext2D, covers: HTMLImageElement[]) {
  const step =
    covers.length > 1 ? (WIDTH - 140 - COVER_W) / (covers.length - 1) : 0;
  const firstMiddle = covers.length > 1 ? 70 + COVER_W / 2 : WIDTH / 2;
  covers.forEach((cover, i) => {
    ctx.save();
    ctx.translate(firstMiddle + step * i, COVERS_MIDDLE);
    ctx.rotate((TILTS[i]! * Math.PI) / 180);
    ctx.fillStyle = INK;
    ctx.fillRect(-COVER_W / 2 + 12, -COVER_H / 2 + 12, COVER_W, COVER_H);
    // cropped to a book's shape, as object-fit: cover would
    const scale = Math.max(COVER_W / cover.width, COVER_H / cover.height);
    const w = COVER_W / scale;
    const h = COVER_H / scale;
    ctx.drawImage(
      cover,
      (cover.width - w) / 2,
      (cover.height - h) / 2,
      w,
      h,
      -COVER_W / 2,
      -COVER_H / 2,
      COVER_W,
      COVER_H,
    );
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.strokeRect(-COVER_W / 2, -COVER_H / 2, COVER_W, COVER_H);
    ctx.restore();
  });
}

// The genre split as stamps, each with its share: "ACTION 53%" biggest and
// first, the rest smaller, every one tilted its own way
function drawGenres(ctx: CanvasRenderingContext2D, genres: GenreShare[]) {
  const total = genres.reduce((n, g) => n + g.count, 0);
  const shown = genres.filter((g) => g.name !== "Other").slice(0, STAMPED);
  if (!shown.length) return;
  const PAD = 26;
  const GAP = 22;
  const stamps = shown.map((genre, i) => {
    const look = STAMPS[i]!;
    const words = `${genre.name.toUpperCase()} ${Math.round((genre.count / total) * 100)}%`;
    ctx.font = `${look.size}px Bangers`;
    return { ...look, words, width: ctx.measureText(words).width + PAD * 2 };
  });
  STAMP_ROWS.forEach((middle, row) => {
    const inRow = stamps.filter((stamp) => stamp.row === row);
    const rowWidth =
      inRow.reduce((n, s) => n + s.width, 0) + GAP * (inRow.length - 1);
    let left = (WIDTH - rowWidth) / 2;
    for (const stamp of inRow) {
      const height = stamp.size * 1.25;
      ctx.save();
      ctx.translate(left + stamp.width / 2, middle);
      ctx.rotate((stamp.tilt * Math.PI) / 180);
      // a hard shadow, the stamp, its ink edge, its letters
      ctx.fillStyle = INK;
      ctx.fillRect(-stamp.width / 2 + 8, -height / 2 + 8, stamp.width, height);
      ctx.fillStyle = stamp.ink;
      ctx.fillRect(-stamp.width / 2, -height / 2, stamp.width, height);
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.strokeRect(-stamp.width / 2, -height / 2, stamp.width, height);
      ctx.fillStyle = stamp.letters;
      ctx.font = `${stamp.size}px Bangers`;
      ctx.textAlign = "center";
      ctx.fillText(stamp.words, 0, stamp.size * 0.36);
      ctx.restore();
      left += stamp.width + GAP;
    }
  });
}

function drawWords(ctx: CanvasRenderingContext2D, picture: ShelfPicture) {
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  fitText(ctx, picture.name.toUpperCase(), "Bangers", 150, WIDTH - 120);
  ctx.fillText(picture.name.toUpperCase(), WIDTH / 2, 220);
  ctx.font = '500 40px "IBM Plex Mono"';
  ctx.fillText(picture.tally, WIDTH / 2, 300);
  drawGenres(ctx, picture.genres);
  ctx.fillStyle = INK;
  ctx.font = "64px Bangers";
  ctx.fillText("MANGA TRACKER", WIDTH / 2, 1210);
  ctx.font = '400 34px "IBM Plex Mono"';
  ctx.fillText("mangatracker.xyz", WIDTH / 2, 1265);
  // the site's tagline, quieter, at the foot
  ctx.globalAlpha = 0.7;
  ctx.font = '400 28px "IBM Plex Sans"';
  ctx.fillText("Read it. Track it. Buy it cheaper.", WIDTH / 2, 1312);
  ctx.globalAlpha = 1;
}

// The picture, as a PNG file. Null where the browser can't make one
export type PictureSize = "post" | "story";
const STORY_HEIGHT = 1920;

export async function drawShelfPicture(
  picture: ShelfPicture,
  size: PictureSize = "post",
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = size === "story" ? STORY_HEIGHT : HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // the faces the lettering is in, in case this page hasn't shown them yet
  await Promise.all([
    document.fonts.load("150px Bangers"),
    document.fonts.load('500 40px "IBM Plex Mono"'),
    document.fonts.load('400 28px "IBM Plex Sans"'),
  ]).catch(() => {});
  const covers = (
    await Promise.all(picture.covers.slice(0, MOST_COVERS).map(loadCover))
  ).filter((cover) => cover !== null);

  drawPaper(ctx, pick(PAPERS));
  // a story is the post, centred on the taller page
  ctx.translate(0, (canvas.height - HEIGHT) / 2);
  drawWords(ctx, picture);
  drawCovers(ctx, covers);
  // (null: a cover the canvas may not read back)
  return pictureOf(canvas);
}

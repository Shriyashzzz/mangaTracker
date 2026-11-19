// The year in manga as one picture to post, 1080 by 1920 (a phone's story):
// the cover of a manga anthology magazine's year issue, in the site's own
// design (no real magazine's name or look). A red masthead, their top three
// series' covers as the cover art over a screentone gradient and speed
// lines, the title the year gave them as the shouted headline, their numbers
// in starburst blurbs, what they spent as the price, and a barcode with the
// site's address. Drawn in the browser, in the site's own lettering.
import { formatCents } from "../../lib/prices";
import {
  ACCENT,
  CARD,
  fitText,
  INK,
  loadPictureCover,
  pictureOf,
} from "../../lib/picture";
import { counted, type YearInManga } from "../../lib/year";

const WIDTH = 1080;
const HEIGHT = 1920;
const PAPER = "#f3eee2";
const YELLOW = "#f8d46b";
const MASTHEAD = 300;

const rad = (deg: number) => (deg * Math.PI) / 180;

// the same every time for one year (a seeded random): a reader posting
// twice gets the same cover
function seeded(seed: number) {
  let n = Math.max(1, seed);
  return () => (n = (n * 16807) % 2147483647) / 2147483647;
}

// Screentone shading: dots that grow from nothing at the top of the art to
// dense at its foot, like a printed gradient
function drawTone(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  ctx.fillStyle = INK;
  const step = 18;
  for (let y = top; y < bottom; y += step) {
    const shade = (y - top) / (bottom - top);
    const r = shade * shade * 6.5;
    if (r < 0.4) continue;
    const shift = (Math.floor((y - top) / step) % 2) * (step / 2);
    for (let x = shift; x < WIDTH + step; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// speed lines from a point behind the covers, thin and uneven, inked
function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  random: () => number,
) {
  ctx.save();
  ctx.fillStyle = INK;
  for (let a = 0; a < 360; a += 2.4 + random() * 3) {
    const wide = 0.25 + random() * 0.6;
    const near = 330 + random() * 120;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad(a)) * near, cy + Math.sin(rad(a)) * near);
    ctx.lineTo(
      cx + Math.cos(rad(a - wide)) * 1500,
      cy + Math.sin(rad(a - wide)) * 1500,
    );
    ctx.lineTo(
      cx + Math.cos(rad(a + wide)) * 1500,
      cy + Math.sin(rad(a + wide)) * 1500,
    );
    ctx.closePath();
    ctx.globalAlpha = 0.18 + random() * 0.25;
    ctx.fill();
  }
  ctx.restore();
}

// a cover on the page: tilted, edged in ink, with a hard shadow
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  tilt: number,
) {
  const h = w * 1.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad(tilt));
  ctx.fillStyle = INK;
  ctx.fillRect(-w / 2 + 16, -h / 2 + 16, w, h);
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(
    image,
    (image.width - sw) / 2,
    (image.height - sh) / 2,
    sw,
    sh,
    -w / 2,
    -h / 2,
    w,
    h,
  );
  ctx.lineWidth = 9;
  ctx.strokeStyle = INK;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

// a starburst blurb: a jagged star in yellow, inked, with a line or two
function drawBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tilt: number,
  lines: string[],
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad(tilt));
  const points = 16;
  const star = () => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const at = (i / (points * 2)) * Math.PI * 2;
      const reach = i % 2 ? r * 0.78 : r;
      ctx.lineTo(Math.cos(at) * reach, Math.sin(at) * reach);
    }
    ctx.closePath();
  };
  ctx.translate(10, 10);
  star();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.translate(-10, -10);
  star();
  ctx.fillStyle = YELLOW;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  const [big, small] = lines;
  fitText(ctx, big!, "Bangers", 96, r * 1.35);
  ctx.fillText(big!, 0, small ? 10 : 32);
  if (small) {
    fitText(ctx, small, "Bangers", 50, r * 1.3);
    ctx.fillText(small, 0, 62);
  }
  ctx.restore();
}

// headline lettering: paper-coloured, thick ink outline, a hard shadow
function shout(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  room: number,
) {
  fitText(ctx, text, "Bangers", size, room);
  ctx.lineJoin = "round";
  ctx.lineWidth = 22;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.fillText(text, x + 12, y + 12);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = CARD;
  ctx.fillText(text, x, y);
}

// a barcode, its bars from the year, with the site under it
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  random: () => number,
) {
  ctx.fillStyle = CARD;
  ctx.fillRect(x - 18, y - 18, 300, 170);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 18, y - 18, 300, 170);
  ctx.fillStyle = INK;
  let at = x;
  while (at < x + 264) {
    const w = 2 + Math.floor(random() * 4) * 2;
    ctx.fillRect(at, y, w, 96);
    at += w + 3 + Math.floor(random() * 3) * 2;
  }
  ctx.font = '500 26px "IBM Plex Mono"';
  ctx.textAlign = "left";
  ctx.fillText("mangatracker.xyz", x, y + 132);
}

export async function drawYearPicture(y: YearInManga): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await Promise.all([
    document.fonts.load("150px Bangers"),
    document.fonts.load('500 40px "IBM Plex Mono"'),
  ]).catch(() => {});
  const random = seeded(y.year * 7 + y.chaptersRead + 1);
  const covers = (
    await Promise.all(
      y.topSeries
        .slice(0, 3)
        .map((s) => loadPictureCover(s.image, 420, s.name)),
    )
  ).filter((c) => c !== null);

  // the page, then the art: speed lines behind the covers, shading at the foot
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawSpeedLines(ctx, WIDTH / 2, 860, random);
  drawTone(ctx, 1050, HEIGHT);

  // the masthead: red, the site's name shouted across it
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, WIDTH, MASTHEAD);
  ctx.fillStyle = INK;
  ctx.fillRect(0, MASTHEAD - 14, WIDTH, 14);
  ctx.textAlign = "left";
  shout(ctx, "MANGA TRACKER", 46, 205, 190, WIDTH - 100);
  ctx.font = '500 30px "IBM Plex Mono"';
  ctx.fillStyle = CARD;
  ctx.fillText(`THE YEAR ISSUE · VOL. ${y.year}`, 52, 262);

  // the cover art: their top three, fanned
  const spots = [
    { x: 300, y: 760, w: 360, tilt: -8 },
    { x: 780, y: 730, w: 360, tilt: 7 },
    { x: 540, y: 830, w: 400, tilt: -1 },
  ];
  covers.forEach((cover, i) => {
    const spot = spots[covers.length === 1 ? 2 : i]!;
    drawCover(ctx, cover, spot.x, spot.y, spot.w, spot.tilt);
  });

  // what they spent, as the issue's price
  if (y.booksBought > 0 && y.spentCents > 0) {
    ctx.save();
    ctx.translate(930, 410);
    ctx.rotate(rad(10));
    ctx.beginPath();
    ctx.arc(0, 0, 105, 0, Math.PI * 2);
    ctx.fillStyle = CARD;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = '500 26px "IBM Plex Mono"';
    ctx.fillText("SPENT", 0, -30);
    fitText(ctx, formatCents(y.spentCents), "Bangers", 64, 170);
    ctx.fillText(formatCents(y.spentCents), 0, 32);
    ctx.restore();
  }

  // the headline: the title the year gave them, shouted
  ctx.save();
  ctx.translate(60, 1330);
  ctx.rotate(rad(-4));
  ctx.textAlign = "left";
  const name = y.title.name.toUpperCase();
  const plain = name.replace(/^THE /, "");
  // the lead-in on a strip of paper tape, so it reads over anything
  ctx.font = "72px Bangers";
  const lead = "THIS YEAR I WAS THE";
  const leadWide = ctx.measureText(lead).width;
  ctx.fillStyle = INK;
  ctx.fillRect(4, -222, leadWide + 36, 92);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(-4, -230, leadWide + 36, 92);
  ctx.fillStyle = INK;
  ctx.fillText(lead, 14, -160);
  shout(ctx, `${plain}!`, 0, 0, 200, WIDTH - 140);
  ctx.restore();

  // the blurbs: their two biggest numbers
  const blurbs: string[][] = [];
  if (y.chaptersRead) blurbs.push([counted(y.chaptersRead), "CHAPTERS!"]);
  else if (y.volumesRead)
    blurbs.push([counted(y.volumesRead), "VOLUMES READ!"]);
  if (y.volumesAdded)
    blurbs.push([`+${counted(y.volumesAdded)}`, "NEW VOLUMES!"]);
  if (y.seriesFinished && blurbs.length < 2)
    blurbs.push([counted(y.seriesFinished), "FINISHED!"]);
  const burstSpots = [
    { x: 190, y: 470, r: 165, tilt: -12 },
    { x: 860, y: 1560, r: 150, tilt: 9 },
  ];
  blurbs.slice(0, 2).forEach((lines, i) => {
    const b = burstSpots[i]!;
    drawBurst(ctx, b.x, b.y, b.r, b.tilt, lines);
  });

  // the title's line, as the cover's strapline on an ink band
  ctx.save();
  ctx.translate(70, 1450);
  ctx.rotate(rad(-4));
  ctx.font = '500 28px "IBM Plex Mono"';
  const lineWide = Math.min(ctx.measureText(y.title.line).width, 640);
  ctx.fillStyle = INK;
  ctx.fillRect(-16, -44, lineWide + 32, 62);
  ctx.fillStyle = CARD;
  ctx.textAlign = "left";
  ctx.fillText(y.title.line, 0, -4, 640);
  ctx.restore();

  drawBarcode(ctx, 70, 1700, random);
  return pictureOf(canvas);
}

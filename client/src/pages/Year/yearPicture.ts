// The year in manga as one picture to post: 1080 by 1920, a phone's story.
// Drawn in the browser like the shelf picture (SharedShelf/shelfPicture.ts),
// in the site's own lettering, on its dotted paper.
import { formatCents } from "../../lib/prices";
import {
  ACCENT,
  CARD,
  drawPaper,
  fitText,
  INK,
  pictureOf,
} from "../../lib/picture";
import { counted, sinceText, type YearInManga } from "../../lib/year";

const WIDTH = 1080;
const HEIGHT = 1920;
const PAPER = "#f3eee2";
const LEFT = 90;
const ROOM = WIDTH - LEFT * 2;

// the stats that go on it, biggest news first; the ones with nothing left off
function statsOf(y: YearInManga) {
  const stats: [string, string][] = [];
  if (y.volumesAdded) stats.push([counted(y.volumesAdded), "volumes added"]);
  if (y.chaptersRead) stats.push([counted(y.chaptersRead), "chapters read"]);
  if (y.volumesRead) stats.push([counted(y.volumesRead), "volumes read"]);
  if (y.seriesFinished)
    stats.push([counted(y.seriesFinished), "series finished"]);
  if (y.booksBought && y.spentCents)
    stats.push([formatCents(y.spentCents), "spent on books"]);
  return stats.slice(0, 4);
}

// a word in a tilted ink block, like the site's headline
function inkBlock(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.font = "150px Bangers";
  const w = ctx.measureText(text).width + 60;
  ctx.save();
  ctx.translate(LEFT, y);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(14, 14, w, 170);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, 170);
  ctx.fillStyle = CARD;
  ctx.fillText(text, 30, 148);
  ctx.restore();
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
    document.fonts.load('500 40px "IBM Plex Sans"'),
  ]).catch(() => {});

  drawPaper(ctx, PAPER);
  ctx.fillStyle = INK;
  ctx.font = "120px Bangers";
  ctx.fillText(`MY ${y.year}`, LEFT, 250);
  inkBlock(ctx, "IN MANGA", 290);
  const since = sinceText(y);
  if (since) {
    ctx.font = '500 40px "IBM Plex Mono"';
    ctx.fillStyle = "#4a443b";
    ctx.fillText(since, LEFT, 560);
  }

  // the numbers, two to a row: a big one, its words under it
  const CELL = ROOM / 2;
  statsOf(y).forEach(([number, words], i) => {
    const x = LEFT + (i % 2) * CELL;
    const top = 640 + Math.floor(i / 2) * 330;
    ctx.fillStyle = INK;
    fitText(ctx, number, "Bangers", 170, CELL - 40);
    ctx.fillText(number, x, top + 160);
    ctx.font = '500 44px "IBM Plex Sans"';
    ctx.fillStyle = ACCENT;
    ctx.fillText(words, x + 4, top + 225);
  });

  // read most, a short list, then the shelf now: lettered like a poster
  let line = 1370;
  if (y.topSeries.length) {
    ctx.fillStyle = INK;
    ctx.font = "64px Bangers";
    ctx.fillText("READ MOST", LEFT, line);
    for (const series of y.topSeries) {
      line += 66;
      fitText(ctx, series.name, "Bangers", 64, ROOM);
      ctx.fillText(series.name, LEFT, line);
    }
    line += 40;
  }
  ctx.fillStyle = "#4a443b";
  const shelf = `My shelf: ${counted(y.shelf.series)} series · ${counted(y.shelf.volumes)} volumes`;
  fitText(ctx, shelf, "Bangers", 64, ROOM);
  ctx.fillText(shelf, LEFT, Math.max(line + 40, HEIGHT - 230));

  // the site, on an ink band at the foot
  ctx.fillStyle = INK;
  ctx.fillRect(0, HEIGHT - 150, WIDTH, 150);
  ctx.fillStyle = CARD;
  ctx.font = "64px Bangers";
  ctx.fillText("MANGA TRACKER", LEFT, HEIGHT - 55);
  ctx.font = '500 36px "IBM Plex Mono"';
  ctx.textAlign = "right";
  ctx.fillText("mangatracker.xyz", WIDTH - LEFT, HEIGHT - 62);
  ctx.textAlign = "left";

  return pictureOf(canvas);
}

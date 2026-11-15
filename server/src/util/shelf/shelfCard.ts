// The picture a shared shelf's link shows when it's pasted in a chat or a
// post: a few of its covers fanned out on the site's yellow dotted paper,
// 1200 by 630 (the size link previews use). The name and the counts are the
// preview's own text (client/server.ts shelfTags), so no lettering is drawn
// here, and no font is needed on the server.
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
// a cover on the card, before it's tilted
const COVER_WIDTH = 250;
const COVER_HEIGHT = 375;
// the ink line around each cover
const EDGE = 6;
// how far each cover is tilted, left to right, and how far apart they sit
const TILTS = [-7, 4, -3, 6, -5];
const STEP = 205;
export const MOST_COVERS = TILTS.length;

const PAPER = "#f8d46b";
const INK = "#1d1a16";

// the yellow paper with its print dots
const paper = () =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <defs><pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.6" fill="${INK}" fill-opacity="0.28"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill="${PAPER}"/>
      <rect width="100%" height="100%" fill="url(#dots)"/>
    </svg>`,
  );

// one cover: cropped to a book's shape, edged in ink, tilted
async function tilted(cover: Buffer, tilt: number) {
  const book = await sharp(cover)
    .resize({ width: COVER_WIDTH, height: COVER_HEIGHT, fit: "cover" })
    .extend({
      top: EDGE,
      bottom: EDGE,
      left: EDGE,
      right: EDGE,
      background: INK,
    })
    .png()
    .toBuffer();
  return sharp(book)
    .rotate(tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// The card, as a JPEG. `covers`: the pictures to fan out, the first at the
// left (more than MOST_COVERS are left off). One that sharp can't read is
// skipped. Null when none could be drawn
export async function shelfCard(covers: Buffer[]): Promise<Buffer | null> {
  const books = (
    await Promise.all(
      covers
        .slice(0, MOST_COVERS)
        .map((cover, i) => tilted(cover, TILTS[i]!).catch(() => null)),
    )
  ).filter((book) => book !== null);
  if (!books.length) return null;

  // centred as a row, each overlapping the one before
  const rowWidth = COVER_WIDTH + STEP * (books.length - 1);
  const firstLeft = Math.round((WIDTH - rowWidth) / 2);
  const placed = await Promise.all(
    books.map(async (book, i) => {
      const { width = 0, height = 0 } = await sharp(book).metadata();
      // a tilted picture is bigger than the cover: placed by its middle
      const middle = firstLeft + STEP * i + COVER_WIDTH / 2;
      return {
        input: book,
        left: Math.round(middle - width / 2),
        top: Math.round((HEIGHT - height) / 2),
      };
    }),
  );
  return sharp(paper()).composite(placed).jpeg({ quality: 82 }).toBuffer();
}

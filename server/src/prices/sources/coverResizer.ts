// Covers at the width a page draws them, as WebP. The places covers come
// from serve a few fixed sizes, and heavy ones: AniList's 230px cover is
// about 80 KB, Open Library's large about 50 KB. Resized here, a sharp
// 330px cover is about 23 KB and a shelf thumbnail about 12 KB.
//
// Each cover and width is made once: the cover routes send it with a
// 30-day Cache-Control and Cloudflare keeps it (a Cache Rule on
// /api/prices/cover/). Making one takes a few milliseconds.
//
// Only the widths listed here are made, so a visitor can't fill the cache
// by asking for every number. The same list is in the client
// (lib/coverSizes.ts COVER_WIDTHS): change both together.
import sharp from "sharp";

export const COVER_WIDTHS = [120, 220, 330, 480] as const;
export type CoverWidth = (typeof COVER_WIDTHS)[number];

// The width to make for what was asked: the narrowest allowed one that's
// at least as wide, or the widest. Null when no width was asked (or it
// isn't a number): the cover goes out as it came
export function allowedWidth(asked: unknown): CoverWidth | null {
  const wanted = Number(asked);
  if (!asked || !Number.isFinite(wanted) || wanted <= 0) return null;
  return COVER_WIDTHS.find((width) => width >= wanted) ?? COVER_WIDTHS.at(-1)!;
}

// WebP's quality setting. At 65 a cover looked the same to the eye as at
// 75 in a side-by-side, and weighs about a tenth less
const QUALITY = 65;

// The picture at that width, as WebP. Never made wider than it is: a 300px
// scan asked for at 480 stays 300. Throws if it isn't a picture sharp can
// read; the caller then sends the original
export async function resizeCover(image: Buffer, width: CoverWidth) {
  return sharp(image)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
}

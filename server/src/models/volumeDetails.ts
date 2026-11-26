// volume_details: what a catalog says of one book (description, pages,
// release date), for its page. Kept from answers the site has anyway
// (sources/googleBooksCatalog.ts) and filled slowly for the rest
// (prices/volumeDetails.ts). Part of the price queries.
import { prisma } from "../config/prisma.js";
import { VOLUMES_KEY_VERSION } from "../prices/volumesKey.js";

export type VolumeDetails = {
  isbn13: string;
  description: string | null;
  pages: number | null;
  published: string | null;
};

// HTML entities Google writes in descriptions, by name; a numbered one
// (&#8217;) is read as its character
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};
const entity = (whole: string, name: string) => {
  const number = /^#(x?)([0-9a-f]+)$/i.exec(name);
  if (number)
    return String.fromCodePoint(parseInt(number[2]!, number[1] ? 16 : 10));
  return ENTITIES[name] ?? whole;
};

// A description as plain text: Google's come as HTML ("<p>…</p><br>"), its
// paragraphs kept as blank lines. Null when nothing's left
export function plainDescription(html: string | null | undefined) {
  const text = (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, entity)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

// a release date the page can say: a day or a month ("2019-11-12",
// "2019-11"). A year alone would read as January
export const knownDay = (date: string | null | undefined) =>
  date && /^\d{4}-\d{2}(-\d{2})?$/.test(date) ? date : null;

// a page count that's a book's own
export const knownPages = (pages: number | null | undefined) =>
  pages != null && pages > 20 && pages < 3000 ? pages : null;

// Saves what's known of each book, filling what a row lacked and never
// erasing a value with nothing. A book asked about with nothing to say is
// saved empty, so it isn't asked again
export async function saveVolumeDetails(
  rows: VolumeDetails[],
  source = "google",
) {
  for (const r of rows) {
    const found = {
      description: plainDescription(r.description)?.slice(0, 5000) ?? null,
      pages: knownPages(r.pages),
      published: knownDay(r.published),
    };
    await prisma.volumeDetail.upsert({
      where: { isbn13: r.isbn13 },
      create: { isbn13: r.isbn13, source, ...found },
      update: {
        ...(found.description ? { description: found.description } : {}),
        ...(found.pages != null ? { pages: found.pages } : {}),
        ...(found.published ? { published: found.published } : {}),
        fetchedAt: new Date(),
      },
    });
  }
}

export const volumeDetailsOf = (isbn13: string) =>
  prisma.volumeDetail.findUnique({
    where: { isbn13 },
    select: { description: true, pages: true, published: true },
  });

// Books on the saved series lists no catalog has been asked about yet:
// the pages people opened first, newest first, then the rest. For the slow
// fill (prices/volumeDetails.ts)
export async function volumesWithoutDetails(limit: number) {
  const rows = await prisma.$queryRaw<{ isbn13: string }[]>`
    WITH listed AS (
      SELECT DISTINCT trim(v->>'isbn13') AS isbn13
      FROM series_volumes sv, jsonb_array_elements(sv.volumes) v
      WHERE sv.key LIKE ${`${VOLUMES_KEY_VERSION}%:final`}
    )
    SELECT l.isbn13
    FROM listed l
    LEFT JOIN books b ON b.isbn13 = l.isbn13
    WHERE l.isbn13 ~ '^97[89][0-9]{10}$'
      AND NOT EXISTS (SELECT 1 FROM volume_details d WHERE d.isbn13 = l.isbn13)
      AND NOT EXISTS (
        SELECT 1 FROM trusted_books t
        WHERE t.isbn13 = l.isbn13 AND t.description IS NOT NULL
      )
    ORDER BY b.opened_at DESC NULLS LAST, l.isbn13
    LIMIT ${limit}
  `;
  return rows.map((r) => r.isbn13);
}

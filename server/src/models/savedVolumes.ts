// The saved lists of each series' volumes (series_volumes), and what's read
// from them. Part of the price queries (priceQueries.ts lists the parts).
import { VOLUMES_KEY_VERSION } from "../prices/volumesKey.js";
import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { CatalogBook } from "../prices/types.js";

// a volume as a series' saved list knows it (the newest list, today's naming
// first). Open Library's own record for an ISBN can be the Japanese title it
// can't name ("オーバーロード15 半森妖精の神人 ［上］"), while the series found
// the English edition inside the work
export async function getSavedVolume(isbn13: string) {
  const [row] = await prisma.$queryRaw<{ volume: CatalogBook }[]>`
    SELECT v AS volume
    FROM series_volumes sv, jsonb_array_elements(sv.volumes) v
    -- only lists saved since light novels were told apart (v3): an older one can
    -- hold a novel's volume under the manga's name
    WHERE sv.key LIKE ${VOLUMES_KEY_VERSION + "%"}
      AND sv.volumes @> ${JSON.stringify([{ isbn13 }])}::jsonb
      AND v->>'isbn13' = ${isbn13}
    ORDER BY sv.fetched_at DESC
    LIMIT 1
  `;
  return row?.volume ?? null;
}

// a volume we know is manga, not any ISBN someone typed in: in a series'
// saved volume list, or priced before (only known volumes get priced, and
// lists are only saved once someone opens the series). For Canada's searches
// how many volumes each of these saved lists has, and the first one's cover
// (missing: never built)
export async function getSavedListSizes(keys: string[]) {
  type Size = { size: number; coverUrl: string | null };
  if (!keys.length) return new Map<string, Size>();
  const rows = await prisma.$queryRaw<(Size & { key: string })[]>`
    SELECT key, jsonb_array_length(volumes)::int AS size,
           volumes->0->>'coverUrl' AS "coverUrl"
    FROM series_volumes WHERE key IN (${Prisma.join(keys)})
  `;
  return new Map(
    rows.map((r) => [r.key, { size: r.size, coverUrl: r.coverUrl }]),
  );
}

// novels the background finder found for these manga (prices/novelFinder.ts),
// by the manga's normalized name
export async function getFoundNovels(keys: string[]) {
  if (!keys.length) return new Map<string, { name: string; volumes: number }>();
  const rows = await prisma.novelCheck.findMany({
    where: { key: { in: keys }, volumes: { gt: 0 }, name: { not: null } },
  });
  return new Map(
    rows.map((r) => [r.key, { name: r.name!, volumes: r.volumes }]),
  );
}

export async function isKnownVolume(isbn13: string) {
  const [row] = await prisma.$queryRaw<{ known: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM series_volumes
      WHERE volumes @> ${JSON.stringify([{ isbn13 }])}::jsonb
    ) OR EXISTS (
      SELECT 1 FROM price_checks WHERE isbn13 = ${isbn13}
    ) AS known
  `;
  return Boolean(row?.known);
}

// a series' last good volume list; see prices/service.ts
// every volume in the series lists saved under today's naming (one per name
// a series is searched by), so a list built before a restart still counts as
// known: series pages and the sitemap read it without the catalog
export async function getSavedVolumeTitles() {
  return prisma.$queryRaw<
    { isbn13: string; title: string; published: string | null }[]
  >`
    SELECT DISTINCT ON (v->>'isbn13') v->>'isbn13' AS isbn13,
           v->>'title' AS title, v->>'published' AS published
    FROM series_volumes sv, jsonb_array_elements(sv.volumes) v
    WHERE sv.key LIKE ${VOLUMES_KEY_VERSION + "%"}
      AND v->>'isbn13' IS NOT NULL AND v->>'title' IS NOT NULL
      -- a 3-in-1 omnibus numbered like a volume isn't one (service.ts
      -- isOmnibusLength); a light novel may run long
      AND (COALESCE((v->>'pages')::int, 0) < 500
           OR v->>'title' ILIKE '%light novel%')
  `;
}

// every series' final list (service.ts finalKey), volume by volume, with the
// key it's saved under
export async function getFinalVolumeTitles() {
  return prisma.$queryRaw<
    { key: string; isbn13: string; title: string; published: string | null }[]
  >`
    SELECT sv.key, v->>'isbn13' AS isbn13, v->>'title' AS title,
           v->>'published' AS published
    FROM series_volumes sv, jsonb_array_elements(sv.volumes) v
    WHERE sv.key LIKE ${VOLUMES_KEY_VERSION + "%:final"}
      AND v->>'isbn13' IS NOT NULL AND v->>'title' IS NOT NULL
  `;
}

// the box sets and omnibuses found while pricing a series' volumes, as their
// checks left them (current only, in stock), one per listing: what a series
// page shows under "Box sets"
export async function getCollectionOffers(isbns: string[]) {
  if (!isbns.length) return [];
  return prisma.$queryRaw<
    {
      isbn13: string;
      store: string;
      priceCents: number;
      url: string | null;
      format: string;
      condition: string;
    }[]
  >`
    SELECT DISTINCT ON (COALESCE(ps.url, ps.store || ps.price_cents))
           ps.isbn13, ps.store, ps.price_cents AS "priceCents", ps.url,
           ps.format, ps.condition
    FROM price_samples ps
    JOIN price_source_checks sc
      ON sc.isbn13 = ps.isbn13 AND sc.source = ps.source
     AND ps.fetched_at = sc.checked_at
    WHERE ps.isbn13 IN (${Prisma.join(isbns)})
      AND ps.format IN ('set', 'omnibus') AND ps.in_stock
    ORDER BY COALESCE(ps.url, ps.store || ps.price_cents), ps.price_cents
  `;
}

// the ISBNs a saved list shows to be a 3-in-1 omnibus numbered like one
// volume (500 pages or more, not a light novel): the books table has no
// page counts, so this is how it knows to leave them out
export async function getOmnibusIsbns() {
  const rows = await prisma.$queryRaw<{ isbn13: string }[]>`
    SELECT DISTINCT v->>'isbn13' AS isbn13
    FROM series_volumes sv, jsonb_array_elements(sv.volumes) v
    WHERE COALESCE((v->>'pages')::int, 0) >= 500
      AND v->>'inBook' IS NULL
      AND v->>'title' NOT ILIKE '%light novel%'
  `;
  return new Set(rows.map((r) => r.isbn13.trim()));
}

export async function getSeriesVolumes(key: string) {
  const row = await prisma.seriesVolumes.findUnique({ where: { key } });
  return (
    row && {
      at: row.fetchedAt.getTime(),
      volumes: row.volumes as unknown as CatalogBook[],
    }
  );
}

export async function saveSeriesVolumes(key: string, volumes: CatalogBook[]) {
  const data = {
    volumes: volumes as unknown as Prisma.InputJsonValue,
    fetchedAt: new Date(),
  };
  await prisma.seriesVolumes.upsert({
    where: { key },
    create: { key, ...data },
    update: data,
  });
}

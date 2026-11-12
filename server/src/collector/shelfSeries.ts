// Each manga on a shelf, with the volumes the saved series lists know for it.
// The same lists the series pages save: the catalog's under the shelf's name
// and under AniList's official one, and Google Books' (which has the dates of
// new and upcoming volumes). Database only: a series nobody has opened yet
// just has no list, and is left out rather than looked up
import { prisma } from "../config/prisma.js";
import type { Manga } from "../../generated/prisma/client.js";
import { priceName } from "../prices/lightNovel.js";
import { slugify } from "../prices/stores/match.js";
import type { CatalogBook, SeriesInfo } from "../prices/types.js";
import { volumesKey } from "../prices/volumesKey.js";
import type { ListedVolume } from "./shelfMath.js";

export type ShelfSeries = {
  manga: Manga;
  volumes: ListedVolume[];
};

const listed = (b: CatalogBook): ListedVolume => ({
  volume: b.volume,
  isbn13: b.isbn13,
  title: b.title,
  coverUrl: b.coverUrl ?? null,
  published: b.published ?? null,
});

// the catalog's volumes first (their ISBNs and titles are the ones priced),
// Google's filling in dates and the volumes not out yet
function merge(main: CatalogBook[], google: CatalogBook[]): ListedVolume[] {
  const byNumber = new Map<string, ListedVolume>();
  const keyOf = (b: CatalogBook) =>
    b.volume === null ? `isbn:${b.isbn13}` : `vol:${b.volume}`;
  for (const b of main)
    if (!byNumber.has(keyOf(b))) byNumber.set(keyOf(b), listed(b));
  for (const b of google) {
    const had = byNumber.get(keyOf(b));
    if (!had) byNumber.set(keyOf(b), listed(b));
    else if (!had.published && b.published) had.published = b.published;
  }
  return [...byNumber.values()];
}

export async function shelfSeries(manga: Manga[]): Promise<ShelfSeries[]> {
  if (!manga.length) return [];
  const names = manga.map((m) => priceName(m));
  // AniList's official name for each, where it's been looked up
  const infos = await prisma.seriesInfo.findMany({
    where: { slug: { in: [...new Set(names.map(slugify))] } },
    select: { slug: true, info: true },
  });
  const official = new Map(
    infos.flatMap((r) => {
      const name = (r.info as SeriesInfo | null)?.name;
      return name ? [[r.slug, name] as const] : [];
    }),
  );
  const keysOf = (name: string) => {
    const both = [...new Set([name, official.get(slugify(name)) ?? name])];
    return {
      // the series page's own list, when it's been built (service.ts finalKey)
      final: both.map((n) => `${volumesKey(n)}:final`),
      main: both.map((n) => volumesKey(n)),
      google: both.map((n) => `${volumesKey(n)}:google`),
    };
  };
  const allKeys = names.flatMap((n) => {
    const k = keysOf(n);
    return [...k.final, ...k.main, ...k.google];
  });
  const rows = await prisma.seriesVolumes.findMany({
    where: { key: { in: [...new Set(allKeys)] } },
    select: { key: true, volumes: true },
  });
  const lists = new Map(
    rows.map((r) => [r.key, r.volumes as unknown as CatalogBook[]]),
  );
  const first = (keys: string[]) =>
    keys.map((k) => lists.get(k)).find((l) => l?.length) ?? [];
  return manga.flatMap((m, i) => {
    const k = keysOf(names[i]!);
    // the page's list as it is; before one exists, the two raw lists merged
    const final = first(k.final);
    const volumes = final.length
      ? final.map(listed)
      : merge(first(k.main), first(k.google));
    return volumes.length ? [{ manga: m, volumes }] : [];
  });
}

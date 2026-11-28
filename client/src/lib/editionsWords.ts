// The /editions page's title and description: the app's own tags
// (pages/Prices/EditionsIndex.tsx) and the site server's (server.ts
// editionsIndexTags) say the same. No browser needed, so both can use it
export const EDITIONS_TITLE = "Omnibus and deluxe manga editions";
export const editionsDescription = (count: number) =>
  `Which volumes are in each omnibus, deluxe and VIZBIG book, for ${count || "every"} manga series, with US prices.`;

// An edition's own page (/prices/series/vagabond/vizbig): its title and
// description, the same from the app (pages/Prices/pageMeta.ts editionMeta)
// and the site server (server.ts editionTags). `cost` is what all its books
// come to, as each says money ("about $360"), or null with too few priced
export const editionPageTitle = (
  series: string,
  label: string,
  books: number,
) => `${series} ${label} manga prices, all ${books} books`;
export const editionPageDescription = (
  series: string,
  label: string,
  books: number,
  cost: string | null,
) =>
  `Which volumes are in each ${series} ${label} book, and US prices for all ${books}.` +
  (cost ? ` Every ${label} book new: ${cost}.` : "");

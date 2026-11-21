// The /editions page's title and description: the app's own tags
// (pages/Prices/EditionsIndex.tsx) and the site server's (server.ts
// editionsIndexTags) say the same. No browser needed, so both can use it
export const EDITIONS_TITLE = "Omnibus and deluxe manga editions";
export const editionsDescription = (count: number) =>
  `Which volumes are in each omnibus, deluxe and VIZBIG book, for ${count || "every"} manga series, with US prices.`;

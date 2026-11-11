// What Manga Tracker does that a price list doesn't, for someone new: the
// home page's panels (pages/Prices/WhyCollectors.tsx) and the home page text
// the site server writes for search engines (client/server.ts) both read
// this, so they always say the same. Only what the app does today
export const WHY_COLLECTORS = [
  {
    title: "The whole run, priced",
    body: "Every series page adds up what collecting it costs new, with box sets beside it.",
    link: "/prices/series/one-piece",
    label: "See One Piece",
  },
  {
    title: "Every store on one page",
    body: "eBay, Books-A-Million, Amazon, Walmart and more, new and used, in the US and Canada.",
    link: "/series",
    label: "Browse series",
  },
  {
    title: "Know when the next one's out",
    body: "Your shelf flags new volumes and chapters, and the calendar shows what's coming.",
    link: "/signup",
    label: "Start your shelf",
  },
  {
    title: "Your shelf, counted",
    body: "See what your collection is worth and what finishing each series costs, then share it with a link.",
    link: "/signup",
    label: "Start your shelf",
  },
] as const;

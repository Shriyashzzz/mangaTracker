// The questions people ask, and short answers. One list for the FAQ page
// (pages/Faq) and for the site's server (server.ts), which writes the same
// words into the page a search engine reads and into its FAQ markup. Plain
// text only: no links or markup in an answer. Keep each true to the app.

type FaqGroup = {
  name: string;
  questions: { q: string; a: string }[];
};

export const FAQ: FaqGroup[] = [
  {
    name: "The basics",
    questions: [
      {
        q: "What is Manga Tracker?",
        a: "A free site for manga readers and collectors. Compare what US stores charge for each volume, keep track of what you own and where you're up to, and see when new volumes come out.",
      },
      {
        q: "Is it free?",
        a: "Yes, all of it. Some links to stores are affiliate links: if you buy through one, the store pays us a small cut at no cost to you. That's what keeps the site running.",
      },
      {
        q: "Do I need an account?",
        a: "Not to check prices. You need one to keep a shelf. It takes a username and a password, and no email address.",
      },
    ],
  },
  {
    name: "Your shelf",
    questions: [
      {
        q: "What's the fastest way to add my collection?",
        a: "Scan the barcodes on your books with your phone, or import a list from MyAnimeList, AniList, Kitsu, Goodreads, Book Catalogue or any CSV file. You can also add a series by name and tick the volumes you own.",
      },
      {
        q: "Can I track volumes instead of chapters?",
        a: "Yes. On any series you can switch between tracking the chapter you're on and the volume you've read up to. In Settings you can pick chapters only, volumes only, or both for your whole shelf.",
      },
      {
        q: "I collect the deluxe or omnibus edition. Will it tell me to buy single volumes?",
        a: "No. On a series that has another edition, set Buy it to Deluxe, Omnibus or 3-in-1. What to buy next and what's left to finish the series are then counted in that edition's books.",
      },
      {
        q: "Can I record what I paid for a book?",
        a: "Yes. Open a series, unfold Your books, and type what you paid and the day you bought it. Your shelf then shows what you've spent so far. Only you can see it.",
      },
      {
        q: "Does it work for light novels?",
        a: "Yes. Light novels have their own prices and volume news, kept apart from the manga of the same name.",
      },
      {
        q: "Can I share my shelf?",
        a: "Yes. Turn on sharing in Settings to get a link you can send to anyone. It shows your series and the volumes you own. Your username and what you paid are never shown.",
      },
      {
        q: "Can I get my data out?",
        a: "Yes. Settings has an export that downloads your whole shelf as a CSV file, and the import reads that file back in.",
      },
    ],
  },
  {
    name: "After the anime",
    questions: [
      {
        q: "I watched the anime. Where do I start the manga?",
        a: "Look the show up on the After the anime page. For each season it gives the chapter to start at and the volume that chapter is in, with that volume's price.",
      },
      {
        q: "Where does that information come from?",
        a: "From MangaUpdates, where readers record the chapter each season ends on. Volume numbers are the Japanese release's, which the English one nearly always matches.",
      },
      {
        q: "What if a season's answer is wrong or missing?",
        a: "Use Suggest a fix under that season and add a link to where you read it. It shows on the page once it has been checked.",
      },
    ],
  },
  {
    name: "Prices",
    questions: [
      {
        q: "Where do the prices come from?",
        a: "From store listings for the exact book, such as Amazon, eBay, Books-A-Million and Walmart. A volume's prices are checked when someone opens its page, and each price says when it was last checked.",
      },
      {
        q: "Why does a volume say Check price?",
        a: "Nobody has opened that volume's page yet, so there's no price saved for it. Open it and its prices are looked up.",
      },
      {
        q: "Why is there no total for finishing a series?",
        a: "A total only shows once most of the series has a price. With only a few volumes priced it would be a guess, so the page gives the count of volumes left and no dollar figure.",
      },
      {
        q: "Does it show box sets?",
        a: "Yes. A series' price page shows its box sets beside the title when any are found, with the cheapest first.",
      },
      {
        q: "Does it work in Canada?",
        a: "Yes. Switch to Canada in the menu or in Settings to see Canadian store prices.",
      },
    ],
  },
  {
    name: "New releases",
    questions: [
      {
        q: "How do I know when a new volume is out?",
        a: "The New tab on your shelf lists the series with a new English volume or chapter you haven't caught up to. The calendar shows every upcoming volume for your shelf, and you can save the dates to your own calendar.",
      },
      {
        q: "Can I preorder a volume?",
        a: "Yes. Volumes show up before they're out, with their release date and links to stores taking preorders.",
      },
      {
        q: "Do you send email alerts?",
        a: "Not yet. For now the New tab and the calendar are where new releases show.",
      },
    ],
  },
];

// every question in one list, for the page's markup
const FAQ_QUESTIONS = FAQ.flatMap((group) => group.questions);

// schema.org's FAQPage, the same wherever it's written
export const faqJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_QUESTIONS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

export const FAQ_DESCRIPTION =
  "Answers about Manga Tracker: adding your collection, tracking volumes or chapters, deluxe and omnibus editions, where prices come from, and new releases.";

// Credits for the services behind the site. MangaDex and MangaUpdates require a
// credit, Open Library asks for a link, Wikipedia's text is shared on the
// condition it's credited, and Amazon and eBay require the affiliate wording
// below word for word. Add a service here when the site starts using it, and
// its affiliate line when its links start earning.
import { usePageMeta } from "../../lib/seo";
import { acknowledgementsStyles as styles } from "./styles";

const DATA = [
  {
    name: "MangaDex",
    url: "https://mangadex.org",
    body: "Chapter and volume data behind the next release dates, and which chapters are in which volume.",
  },
  {
    name: "MangaUpdates",
    url: "https://www.mangaupdates.com",
    body: "Chapter counts, whether a series has finished, and a rating for series the others have no score for.",
  },
  {
    name: "Wikipedia",
    url: "https://www.wikipedia.org",
    body: "Which chapters are in which volume, from its chapter lists, where MangaDex doesn't say.",
  },
  {
    name: "AniList",
    url: "https://anilist.co",
    body: "Series details, scores, genres and what's trending.",
  },
  {
    name: "MyAnimeList",
    url: "https://myanimelist.net",
    body: "Series scores, through its own API.",
  },
  {
    name: "Kitsu",
    url: "https://kitsu.app",
    body: "Importing a list from a Kitsu account.",
  },
  {
    name: "Open Library",
    url: "https://openlibrary.org",
    body: "Volume details and cover images.",
  },
  {
    name: "Google Books",
    url: "https://books.google.com",
    body: "New and upcoming volumes, their release dates, covers Open Library doesn't have, and ebook prices.",
  },
];

// where the prices come from
const PRICES = [
  {
    name: "eBay",
    url: "https://www.ebay.com",
    body: "New and used prices, through eBay's own API.",
  },
  {
    name: "Books-A-Million",
    url: "https://www.booksamillion.com",
    body: "Prices and box sets.",
  },
  {
    name: "Better World Books",
    url: "https://www.betterworldbooks.com",
    body: "Used prices, through Impact.",
  },
];

// the open-source code doing the heavy lifting
const TOOLS = [
  {
    name: "ZXing",
    url: "https://github.com/zxing-js/library",
    body: "Reading barcodes with your camera.",
  },
  {
    name: "sharp",
    url: "https://sharp.pixelplumbing.com",
    body: "Resizing covers so pages load fast.",
  },
];

type Credit = { name: string; url: string; body: string };

// one titled list of credits
function CreditList({
  id,
  title,
  credits,
}: {
  id: string;
  title: string;
  credits: Credit[];
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {/* role: Safari stops announcing a list once its bullets are styled away */}
      <ul role="list" className={styles.items}>
        {credits.map((credit) => (
          <li key={credit.name} className={styles.item}>
            <a
              href={credit.url}
              target="_blank"
              rel="noreferrer"
              className={styles.itemName}
            >
              {credit.name}
            </a>
            <p className={styles.itemBody}>{credit.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AcknowledgementsPage() {
  usePageMeta({
    title: "Acknowledgements",
    description:
      "The services and tools behind Manga Tracker, where its prices come from, the fonts it uses and how its affiliate links work.",
    path: "/acknowledgements",
  });

  return (
    <article className={`${styles.page} fade-in`}>
      <header>
        <h1 className={styles.title}>Acknowledgements</h1>
        <p className={styles.lead}>
          Manga Tracker is built on the work of these services and tools. Thank
          you.
        </p>
      </header>

      <CreditList id="ack-data" title="Manga and book data" credits={DATA} />
      <CreditList id="ack-prices" title="Prices" credits={PRICES} />

      <section aria-labelledby="ack-fonts">
        <h2 id="ack-fonts" className={styles.sectionTitle}>
          Fonts
        </h2>
        <p className={styles.body}>
          Bangers, Caveat, Comic Neue, Dela Gothic One, Fraunces, IBM Plex Mono
          and IBM Plex Sans, served by{" "}
          <a
            href="https://fonts.google.com"
            target="_blank"
            rel="noreferrer"
            className={styles.itemName}
          >
            Google Fonts
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="ack-affiliate">
        <h2 id="ack-affiliate" className={styles.sectionTitle}>
          Affiliate links
        </h2>
        <p className={styles.body}>
          Some store links are affiliate links: buying through one pays the site
          a small commission, at no extra cost to you.
        </p>
        <p className={styles.body}>
          As an Amazon Associate I earn from qualifying purchases.
        </p>
        <p className={styles.body}>
          As an eBay Partner Network Affiliate, I earn from qualifying
          purchases.
        </p>
        <p className={styles.body}>
          I also earn from qualifying purchases through Bookshop.org links,
          Books-A-Million links and Better World Books links (through Impact).
        </p>
      </section>

      <CreditList id="ack-tools" title="Open-source tools" credits={TOOLS} />

      <section aria-labelledby="ack-ownership">
        <h2 id="ack-ownership" className={styles.sectionTitle}>
          Manga titles and covers
        </h2>
        <p className={styles.body}>
          Manga titles and covers belong to their creators and publishers.
        </p>
      </section>
    </article>
  );
}

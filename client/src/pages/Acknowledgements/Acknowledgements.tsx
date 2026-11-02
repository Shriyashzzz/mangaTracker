// Credits for the services behind the site. MangaDex and MangaUpdates require a
// credit, Open Library asks for a link, and Amazon and eBay require the
// affiliate wording below. Add a service here when the site starts using it.
import { usePageMeta } from "../../lib/seo";
import { acknowledgementsStyles as styles } from "./styles";

const DATA = [
  {
    name: "MangaDex",
    url: "https://mangadex.org",
    body: "Chapter and volume data behind the next release dates.",
  },
  {
    name: "MangaUpdates",
    url: "https://www.mangaupdates.com",
    body: "Chapter counts, and whether a series has finished.",
  },
  {
    name: "AniList",
    url: "https://anilist.co",
    body: "Series details, scores, genres and what's trending.",
  },
  {
    name: "Open Library",
    url: "https://openlibrary.org",
    body: "Volume details and cover images.",
  },
  {
    name: "Google Books",
    url: "https://books.google.com",
    body: "Ebook prices.",
  },
];

export function AcknowledgementsPage() {
  usePageMeta({
    title: "Acknowledgements",
    description:
      "The services behind Manga Tracker, the fonts it uses and how its affiliate links work.",
    path: "/acknowledgements",
  });

  return (
    <article className={`${styles.page} fade-in`}>
      <header>
        <h1 className={styles.title}>Acknowledgements</h1>
        <p className={styles.lead}>
          Manga Tracker is built on the work of these services. Thank you.
        </p>
      </header>

      <section aria-labelledby="ack-data">
        <h2 id="ack-data" className={styles.sectionTitle}>
          Manga and book data
        </h2>
        {/* role: Safari stops announcing a list once its bullets are styled away */}
        <ul role="list" className={styles.items}>
          {DATA.map((source) => (
            <li key={source.name} className={styles.item}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className={styles.itemName}
              >
                {source.name}
              </a>
              <p className={styles.itemBody}>{source.body}</p>
            </li>
          ))}
        </ul>
      </section>

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
          Some store links are affiliate links which will be used to keep the
          server running.
        </p>
        <p className={styles.body}>
          As an Amazon Associate I earn from qualifying purchases.
        </p>
        <p className={styles.body}>
          As an eBay Partner Network Affiliate, I earn from qualifying
          purchases.
        </p>
        <p className={styles.body}>
          I also earn from qualifying purchases through Bookshop.org links.
        </p>
      </section>

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

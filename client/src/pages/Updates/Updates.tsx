import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import { usePageMeta } from "../../lib/seo";
import { useReleaseChecksOn } from "../../lib/prefs";
import { openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import { updatesStyles as styles } from "./styles";

// the big features only, a line each. Add new ones here when they ship
const UPDATES = [
  {
    name: "Upcoming Releases",
    body: "Every volume coming out for your shelf, circled on a calendar. Save the dates to Google, Apple or Outlook, one at a time or a whole month at once.",
  },
  {
    name: "A New tab that keeps up",
    body: "A big shelf's new volumes sort themselves into Just out, One to get, A few behind and Way behind, and the tab opens straight away.",
  },
  {
    name: "What your shelf is worth",
    body: "See what your collection is worth from the prices we've recorded, and which volumes are on sale right now.",
  },
  {
    name: "Preorder upcoming volumes",
    body: "Volumes show up before they're out, with their release date and where to preorder them.",
  },
  {
    name: "Scan your volumes",
    body: "Point your phone at the barcodes on a stack of volumes and they go straight onto your shelf.",
  },
  {
    name: "Finish the series",
    body: "See what the volumes not on your shelf cost, all together.",
  },
  {
    name: "Track the volumes you own",
    body: "Mark which volumes are on your shelf, and see what's next to get.",
  },
  {
    name: "Light novels",
    body: "Add and price light novels alongside your manga.",
  },
  {
    name: "A To read list",
    body: "Save what you want to read next, from your shelf or any series' price page, and start it when you're ready.",
  },
  {
    name: "Import from more places",
    body: "Bring your list from Goodreads, AniList, Kitsu, Book Catalogue, or any CSV, alongside MyAnimeList.",
  },
];

export function UpdatesPage() {
  usePageMeta({
    title: "What's new",
    description:
      "New on Manga Tracker: see new English volumes and chapters and next chapter dates. Email alerts are coming soon.",
    path: "/updates",
  });
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const checksOn = useReleaseChecksOn();

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          What's <span className={styles.hit}>new</span>
        </h1>
        <span className={styles.kenji} aria-hidden>
          <Mascot mood="happy" />
        </span>
      </header>

      <section className={styles.panel} aria-labelledby="updates-lead">
        {/* drawn, not a real shelf card: it shows what to look out for */}
        <div className={styles.panelArt} aria-hidden>
          <span className={styles.sfx}>New!</span>
          <div className={styles.sample}>
            <p className={styles.sampleRelease}>Vol. 25 is out</p>
            <p className={styles.sampleYours}>You own up to vol. 24</p>
          </div>
        </div>
        <div className={styles.panelCopy}>
          <h2 id="updates-lead" className={styles.panelTitle}>
            New English volumes
          </h2>
          <p>See which series have a new volume or chapter out.</p>
          {isSignedIn === false && (
            <NavLink
              to="/signup"
              className="btn btn-primary mt-2"
              viewTransition
            >
              Start your shelf
            </NavLink>
          )}
          {isSignedIn && checksOn && (
            <NavLink
              to="/shelf"
              className="btn btn-primary mt-2"
              onClick={openReleasesOnShelf}
              viewTransition
            >
              Check shelf
            </NavLink>
          )}
        </div>
      </section>

      {/* role: Safari stops announcing a list once its bullets are styled away */}
      <ul role="list" className={styles.items}>
        {UPDATES.map((update) => (
          <li key={update.name} className={styles.item}>
            <h2 className={styles.itemName}>{update.name}</h2>
            <p className={styles.itemBody}>{update.body}</p>
          </li>
        ))}
      </ul>

      <section className={styles.soon} aria-labelledby="updates-soon">
        <span className={styles.soonSfx} aria-hidden>
          Soon!
        </span>
        <h2 id="updates-soon" className={styles.soonTitle}>
          Email alerts
        </h2>
        <p className={styles.itemBody}>
          Get an email when a new chapter or volume is out.
        </p>
      </section>
    </article>
  );
}

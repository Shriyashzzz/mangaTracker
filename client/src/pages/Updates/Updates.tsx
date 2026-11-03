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
    name: "Better search results",
    body: "Greater accuracy and a wider list of live prices.",
  },
  {
    name: "Share your list",
    body: "Send friends your list, with your notes if you want.",
  },
  {
    name: "Choose what shows up in New",
    body: "Just the next one, within a few, or everything that's out.",
  },
  {
    name: "Import from MyAnimeList",
    body: "Bring your whole manga list over in one go.",
  },
  {
    name: "Next chapter dates",
    body: "See when the next chapter should land.",
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

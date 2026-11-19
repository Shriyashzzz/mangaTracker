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
    name: "Alerts on your phone",
    body: "Switch them on in Settings: a volume for your shelf the day it's out, and price drops on your To buy list. On iPhone, they work in the installed app.",
  },
  {
    name: "The app on your phone",
    body: "Install Manga Tracker from the menu. It opens on your shelf even with no signal, and the chapters and volumes you change offline save when you're back.",
  },
  {
    name: "A weekly email",
    body: "Switch it on in Settings for one email a week: volumes for your shelf that just came out or are due soon, and price drops on your To buy list. Quiet weeks, no email.",
  },
  {
    name: "Your shelf, by edition",
    body: "Collect a series as VIZBIG, Definitive or 3-in-1? Your shelf, your place and the New tab count in that edition's books, and say when its next one is out.",
  },
  {
    name: "Forgot your password?",
    body: "Add an email when you sign up or in Settings, and reset a forgotten password from the sign-in page.",
  },
  {
    name: "After the anime",
    body: "Finished a season? Look up the show and see which chapter of the manga to start at, which volume that's in, and what it costs.",
  },
  {
    name: "Read by volume",
    body: "Keep your place by chapter, by volume, or both. Switch it for one series on its page, or for your whole shelf in Settings.",
  },
  {
    name: "Deluxe and omnibus editions",
    body: "Tell a series which edition you collect, and the next book to buy and the cost to finish follow that edition instead of single volumes.",
  },
  {
    name: "What you've spent",
    body: "Note what you paid for each book and the day you bought it, and see what you've spent on a series and on your whole shelf. Only you can see it.",
  },
  {
    name: "Box sets up front",
    body: "A series' price page shows its box sets first, with its deluxe and omnibus books listed underneath.",
  },
  {
    name: "Upcoming Releases",
    body: "Every volume coming out for your shelf, circled on a calendar. Save the dates to Google, Apple or Outlook, one at a time or a whole month at once.",
  },
  {
    name: "A New tab that keeps up",
    body: "A big shelf's new volumes sort themselves into Next for you, A few behind and Way behind, and the tab opens straight away.",
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
      "New on Manga Tracker: an app for your phone that works offline, a weekly email for your shelf, shelves that count in deluxe and omnibus books, and new English volumes.",
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
            <p className={styles.sampleRelease}>Vol. 25 next</p>
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
          A release calendar for everyone
        </h2>
        <p className={styles.itemBody}>
          Every English volume coming out, week by week, whether you have a
          shelf or not.
        </p>
      </section>
    </article>
  );
}

import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import { usePageMeta } from "../../lib/seo";
import { openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import { updatesStyles as styles } from "./styles";

// every feature that ships goes here: add it to the group it helps with, or start
// a new group. Nothing else on the page needs touching
const GROUPS = [
  {
    title: "Know what's next",
    items: [
      {
        name: "Your next volume, one tap away",
        body: "The New tab shows the next volume you need. Tap it to go straight to its prices.",
      },
      {
        name: "Next chapter dates",
        body: "A volume behind? The manga's page shows when the next chapter should land.",
      },
      {
        name: "Next volume's price",
        body: "The manga's page shows the next volume you need and the lowest price we've seen.",
      },
      {
        name: "Seen it",
        body: "Not ready for that one yet? Tap Seen it to clear it from the New tab. You can undo it straight away.",
      },
      {
        name: "Ahead in Japan",
        body: "Caught up with English? The New tab's In Japan view shows the volumes already out there.",
      },
    ],
  },
  {
    title: "Keep your place",
    items: [
      {
        name: "Move your chapter in one tap",
        body: "Use the − and + right on the manga's page. No form to fill in.",
      },
      {
        name: "Back where you were",
        body: "Come back from a manga and your shelf is at the same spot, on the same page.",
      },
      {
        name: "Straight to your shelf",
        body: "Signed in? Opening the site now takes you to your shelf. Prices is one tap away.",
      },
      {
        name: "Quick add",
        body: "Pick a title and the cover and genre fill in.",
      },
      {
        name: "Fix a genre",
        body: "Edit details now lets you change a manga's genre.",
      },
    ],
  },
  {
    title: "Find a better price",
    items: [
      {
        name: "A clearer price list",
        body: "Tap anywhere on a row to go to that store. Stores we have no price from are listed underneath, since they could be cheaper.",
      },
      {
        name: "Track it from the top",
        body: "Add a volume to your shelf right under its title, before you head off to a store.",
      },
      {
        name: "Price history, folded away",
        body: "The lowest price we've seen shows at a glance. Open it when you want the rest.",
      },
    ],
  },
  {
    title: "Easier to use",
    items: [
      {
        name: "Made for thumbs",
        body: "On phones, Prices and My shelf sit along the bottom, and buttons and small links are easier to hit.",
      },
      {
        name: "Easier to read",
        body: "Small text has stronger contrast, and stars are inked so they hold up on pale paper.",
      },
      {
        name: "Works with a keyboard",
        body: "There's a skip link, stars move with the arrow keys, and screen readers hear when things change.",
      },
    ],
  },
];

export function UpdatesPage() {
  usePageMeta({
    title: "What's new",
    description:
      "Everything new on Manga Tracker: see your next English volume, move your chapter in one tap, and find a better price.",
    path: "/updates",
  });
  const isSignedIn = useAuth((s) => s.isSignedIn);

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>
            What's <span className={styles.hit}>new</span>
          </h1>
          <p className={styles.lead}>
            Everything we've added to help you keep up with your manga and pay
            less for it.
          </p>
        </div>
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
          <p>
            See which series on your shelf have a new volume or chapter out in
            English.
          </p>
          {isSignedIn === false ? (
            <NavLink
              to="/signup"
              className="btn btn-primary mt-2"
              viewTransition
            >
              Start your shelf
            </NavLink>
          ) : (
            isSignedIn && (
              <NavLink
                to="/shelf"
                className="btn btn-primary mt-2"
                onClick={openReleasesOnShelf}
                viewTransition
              >
                Check shelf
              </NavLink>
            )
          )}
        </div>
      </section>

      {GROUPS.map((group) => (
        <section
          key={group.title}
          className={styles.group}
          aria-label={group.title}
        >
          <h2 className={styles.groupTitle}>{group.title}</h2>
          <ul className={styles.items}>
            {group.items.map((item) => (
              <li key={item.name}>
                <h3 className={styles.itemName}>{item.name}</h3>
                <p className={styles.itemBody}>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

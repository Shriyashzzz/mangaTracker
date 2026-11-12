import { NavLink } from "react-router";
import TakeTourButton from "../../components/tour/TakeTourButton";
import Mascot from "../../components/mascot/Mascot";

import { aboutStyles as styles } from "./styles";
import { usePageMeta } from "../../lib/seo";
import { CoffeeIcon } from "../../components/icons/Icons";
import { SUPPORT_URL, stopAsking } from "../../lib/support";

const CONTACT_EMAIL = "ghimireshriyash@gmail.com";

// the three problems the app fixes and the payoff, told as a four-panel strip
const STRIP = [
  {
    mood: "confused" as const,
    caption: "Ten series at once.",
    line: "Wait… which chapter was I on?",
  },
  {
    mood: "panic" as const,
    caption: "Vol. 12 came out in May.",
    line: "How did I miss it??",
  },
  {
    mood: "confused" as const,
    caption: "$14 for one volume.",
    line: "Is that… a good price?",
  },
  {
    mood: "happy" as const,
    caption: "Now it's all in one place.",
    line: "Ch. 327. Vol. 12. Only $8!",
  },
];

export function AboutPage() {
  usePageMeta({
    title: "About",
    description:
      "Why Manga Tracker exists: compare what US stores charge for each manga volume, keep your place in every series, and see which ones have new volumes out.",
    path: "/about",
  });
  return (
    <article className={`${styles.page} fade-in`}>
      {/* opening panel: who made this and why */}
      <header className={styles.hero}>
        <div className={styles.heroArt}>
          {/* Kenji keeps his printed colours in dark mode too */}
          <span className={`${styles.heroMascot} printed`}>
            <Mascot mood="happy" />
          </span>
          <p className={styles.heroBubble}>Yo! Welcome to the shelf.</p>
        </div>

        <div className={styles.heroCopy}>
          <h1 className={styles.title}>
            <span className={styles.hit}>keep up</span> with your manga!
          </h1>
          <p className={styles.lead}>
            Hi, I'm Shriyash. I tend to start way too many manga at once and
            drop them the moment I lose my place.{" "}
            <NavLink to="/shelf" viewTransition>
              Shelf
            </NavLink>{" "}
            fixes that by saving your exact chapter in seconds.
          </p>
          <p className={styles.lead}>
            As a broke college student who loves physical manga, I feel for
            y'all fellow broke students.{" "}
            <NavLink to="/" viewTransition>
              Price check
            </NavLink>{" "}
            searches US stores so you never overpay for a volume.
          </p>
        </div>
      </header>

      {/* the problem, in panels */}
      <section aria-labelledby="strip-title">
        <h2 id="strip-title" className={styles.sectionTitle}>
          Sound familiar?
        </h2>
        <ol className={`${styles.strip} printed`}>
          {STRIP.map((panel) => (
            <li key={panel.caption} className={styles.panel}>
              <p className={styles.caption}>{panel.caption}</p>
              <div className={styles.panelArt}>
                <Mascot mood={panel.mood} />
              </div>
              <p className={styles.bubble}>{panel.line}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* the two halves of the site, one panel each */}
      <section aria-labelledby="does-title">
        <h2 id="does-title" className={styles.sectionTitle}>
          What it can do
        </h2>
        <div className={styles.does}>
          <section className={styles.doesPanel} aria-labelledby="does-shelf">
            <div
              className={`${styles.doesArt} ${styles.doesLines}`}
              aria-hidden
            >
              <span className={styles.doesBig}>
                <small>ch.</small>327
              </span>
              <span className={styles.doesSfx}>Saved!</span>
            </div>
            <div className={styles.doesCopy}>
              <h3 id="does-shelf" className={styles.doesTitle}>
                Your shelf
              </h3>
              <p>
                Save your chapter, rate what you finish, track what you own.
              </p>
              <NavLink to="/shelf" className={styles.doesLink} viewTransition>
                Open my shelf →
              </NavLink>
            </div>
          </section>

          <section className={styles.doesPanel} aria-labelledby="does-prices">
            <div className={`${styles.doesArt} ${styles.doesTone}`} aria-hidden>
              <span className={styles.doesBig}>$8</span>
              <span className={styles.doesSfx}>Deal!</span>
            </div>
            <div className={styles.doesCopy}>
              <h3 id="does-prices" className={styles.doesTitle}>
                Price check
              </h3>
              <p>
                See what US stores charge for any volume, and its price history.
              </p>
              <NavLink to="/" className={styles.doesLink} viewTransition>
                Check a price →
              </NavLink>
            </div>
          </section>
        </div>
      </section>

      <div className={styles.cta}>
        <NavLink to="/shelf" className="btn btn-primary btn-lg" viewTransition>
          Okay, let me try it
        </NavLink>
        <TakeTourButton large />
      </div>

      <section className={styles.contact} aria-labelledby="contact-title">
        <h2 id="contact-title" className={styles.contactTitle}>
          Feedback or questions?
        </h2>
        <p className={styles.contactBody}>
          Found a bug, want a feature or just want to say hi? Send me an email.
          Manga Tracker is free, and if it's saved you money, you can buy me a
          coffee.
        </p>
        <div className={styles.contactButtons}>
          <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-secondary">
            Contact me
          </a>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            onClick={stopAsking}
          >
            <CoffeeIcon />
            Buy me a coffee
          </a>
        </div>
        <p className={styles.contactAddress}>{CONTACT_EMAIL}</p>
        <NavLink
          to="/acknowledgements"
          className={styles.credits}
          viewTransition
        >
          Acknowledgements
        </NavLink>
      </section>
    </article>
  );
}

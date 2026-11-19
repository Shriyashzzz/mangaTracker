import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { getPricedCount } from "../../lib/prices";
import TakeTourButton from "../../components/tour/TakeTourButton";
import Mascot from "../../components/mascot/Mascot";

import { aboutStyles as styles } from "./styles";
import { usePageMeta } from "../../lib/seo";
import { CoffeeIcon } from "../../components/icons/Icons";
import { SUPPORT_URL, stopAsking } from "../../lib/support";
import { inPlayApp } from "../../lib/playApp";
import { useAuth } from "../../store/auth";
import InstallAppButton from "../../components/installApp/InstallAppButton";
import { CONTACT_EMAIL } from "../../lib/contact";

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

// the "volumes priced" count, 0 until it arrives (or if it can't)
function usePricedCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getPricedCount(controller.signal)
      .then(setCount)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return count;
}

export function AboutPage() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const pricedVolumes = usePricedCount();
  usePageMeta({
    title: "About",
    description:
      "Why Manga Tracker exists: compare what US and Canadian stores charge for each manga volume, keep your place in every series, and see which ones have new volumes out.",
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
          <p className={styles.heroBubble}>Psst. Vol. 23 dropped.</p>
        </div>

        <div className={styles.heroCopy}>
          <h1 className={styles.title}>
            <span className={styles.hit}>never lose</span> your place again.
          </h1>
          <p className={styles.lead}>
            Hello, I'm Shriyash. I am a solo developer behind this site, I like
            to collect physical mangas. Keeping track of your bookmarks when you
            read multiple series concurrently can be difficult.
            <br />
            It's also hard to keep track when new volumes come out for your
            favourite series. You can sign up for Shelf so you never have to
            manually look that up for every series you own.
          </p>
          <p className={styles.lead}>
            I'm also a broke college student, and this hobby can be expensive.
            You can use{" "}
            <NavLink to="/" viewTransition>
              Price check
            </NavLink>{" "}
            to find the cheapest deals across US and Canadian stores.
          </p>
          <p>
            One of my favourite series is Vagabond. It has very much changed my
            life.
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
                Save the last chapter you read, rate what you finish, track what
                you own.
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
                See what US and Canadian stores charge for any volume, and its
                price history.
                {/* a real count, said plainly; left out until it's loaded */}
                {pricedVolumes > 0 &&
                  ` ${pricedVolumes.toLocaleString("en-US")} volumes priced in the last 30 days.`}
              </p>
              <NavLink to="/" className={styles.doesLink} viewTransition>
                Check a price →
              </NavLink>
            </div>
          </section>
        </div>
      </section>

      <div className={styles.cta}>
        {/* the real thing, or a practice shelf with no account first */}
        <NavLink to="/shelf" className="btn btn-primary btn-lg" viewTransition>
          {isSignedIn ? "Open your shelf" : "Start your shelf"}
        </NavLink>
        <TakeTourButton large>Try the demo first →</TakeTourButton>
      </div>
      {/* on a phone or a laptop that can install it; nothing elsewhere */}
      <p className={styles.installLine}>
        <InstallAppButton className={styles.installButton}>
          Install Manga Tracker as an app →
        </InstallAppButton>
      </p>

      <section className={styles.contact} aria-labelledby="contact-title">
        <h2 id="contact-title" className={styles.contactTitle}>
          Feedback or questions?
        </h2>
        <p className={styles.contactBody}>
          Found a bug, want a feature or just want to say hi? Send me an email.
        </p>
        {/* no coffee asks inside the Google Play app (lib/playApp.ts) */}
        {!inPlayApp() && (
          <p className={styles.contactBody}>
            Made by a collector, for collectors. A coffee keeps it free.
          </p>
        )}
        <div className={styles.contactButtons}>
          <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-secondary">
            Contact me
          </a>
          {!inPlayApp() && (
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
          )}
        </div>
        <p className={styles.contactAddress}>{CONTACT_EMAIL}</p>
        <NavLink
          to="/acknowledgements"
          className={styles.credits}
          viewTransition
        >
          Acknowledgements
        </NavLink>
        <NavLink to="/privacy" className={styles.credits} viewTransition>
          Privacy policy
        </NavLink>
      </section>
    </article>
  );
}

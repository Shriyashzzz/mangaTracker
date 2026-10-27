import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";

import { aboutStyles as styles } from "./styles";
import { usePageMeta } from "../../lib/seo";

// the two problems the app fixes, told as a three-panel strip
const STRIP = [
  {
    mood: "confused" as const,
    caption: "Ten series at once.",
    line: "Wait… which chapter was I on?",
  },
  {
    mood: "panic" as const,
    caption: "Someone asks for your favourite.",
    line: "Uh… they were all good??",
  },
  {
    mood: "happy" as const,
    caption: "Now the shelf remembers.",
    line: "Ch. 327. And Vagabond's a five.",
  },
];


export function AboutPage() {
  usePageMeta({
    title: "About",
    description:
      "Why Manga Tracker exists: compare what US stores charge for each manga volume, and keep your place in every series you read.",
    path: "/about",
  });
  return (
    <article className={`${styles.page} fade-in`}>
      {/* opening panel: who made this and why */}
      <header className={`${styles.hero} printed`}>
        <div className={styles.heroArt}>
          <Mascot mood="happy" />
          <p className={styles.heroBubble}>Yo! Welcome to the shelf.</p>
        </div>

        <div className={styles.heroCopy}>
          <h1 className={styles.title}>
            <span className={styles.hit}>bookmark</span> for your mangas!
          </h1>
          <p className={styles.lead}>
            Hi, I'm Shriyash. I tend to start way too many manga at once and
            drop them the moment I lose my place. <a href="/shelf">Shelf</a>{" "}
            fixes that by saving your exact chapter in seconds.
          </p>
          <p className={styles.lead}>
            As a broke college student who loves physical manga,I feel for y'all
            fellow broke students. <a href="/">Price Tracker</a> searches US
            stores so you never overpay for a volume.
          </p>
        </div>
      </header>

      {/* the problem, in three panels */}
      <section aria-labelledby="strip-title">
        <h2 id="strip-title" className={styles.sectionTitle}>
          Sound familiar?
        </h2>
        <ol className={`${styles.strip} printed`}>
          {STRIP.map((panel) => (
            <li key={panel.mood} className={styles.panel}>
              <p className={styles.caption}>{panel.caption}</p>
              <div className={styles.panelArt}>
                <Mascot mood={panel.mood} />
              </div>
              <p className={styles.bubble}>{panel.line}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.backMatter}>
        {/* what's being worked on, as a next-volume teaser */}
        <section className={styles.next} aria-labelledby="next-title">
          <span className={styles.nextSfx} aria-hidden>
            New!
          </span>
          <h2 id="next-title" className={styles.nextTitle}>
            Now out: price check
          </h2>
          <p>
            Search any volume and compare prices from US stores, so you never
            overpay for the next one.
          </p>
        </section>

        <div className={styles.cta}>
          <NavLink to="/" className="btn btn-primary btn-lg" viewTransition>
            Okay, let me try it
          </NavLink>
        </div>
      </div>
    </article>
  );
}

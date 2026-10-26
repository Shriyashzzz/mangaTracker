import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import styles from "./About.module.css";

// the two problems the app fixes, told as a three-panel strip
const STRIP = [
  {
    mood: "confused",
    caption: "Ten series at once.",
    line: "Wait… which chapter was I on?",
  },
  {
    mood: "panic",
    caption: "Someone asks for your favourite.",
    line: "Uh… they were all good??",
  },
  {
    mood: "happy",
    caption: "Now the shelf remembers.",
    line: "Ch. 327. And Vagabond's a five.",
  },
];

const STACK = [
  { name: "React", role: "Frontend" },
  { name: "React Router", role: "Routing" },
  { name: "Express", role: "Backend" },
  { name: "PostgreSQL", role: "Database" },
  { name: "Vite", role: "Bundler" },
  { name: "AniList", role: "Covers" },
];

export function AboutPage() {
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
            I kept losing my place. So I built a{" "}
            <span className={styles.hit}>bookmark.</span>
          </h1>
          <p className={styles.lead}>
            I'm Shriyash. I read way too many manga at once, and with ADHD I'd
            forget where I stopped and end up scrolling through 50 chapters to
            find my spot.
          </p>
          <p className={styles.lead}>
            Now I jot down the chapter I'm on, rate what I finish, and pick
            right back up. That's the whole app.
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

        {/* the credits page at the back of a volume */}
        <section className={styles.credits} aria-labelledby="credits-title">
          <h2 id="credits-title" className={styles.creditsTitle}>
            Staff
          </h2>
          <dl className={styles.creditList}>
            {STACK.map((t) => (
              <div key={t.name}>
                <dt>{t.role}</dt>
                <dd>{t.name}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className={styles.cta}>
        <NavLink to="/" className="btn btn-primary btn-lg" viewTransition>
          Okay, let me try it
        </NavLink>
      </div>
    </article>
  );
}

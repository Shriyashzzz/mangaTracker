import { NavLink } from "react-router";
import styles from "./About.module.css";

const STACK = [
  { name: "React", role: "Frontend" },
  { name: "Express", role: "Backend" },
  { name: "PostgreSQL", role: "Database" },
  { name: "React Router", role: "FE Routing" },
  { name: "Vite", role: "Bundler" },
  { name: "CSS Modules", role: "Styling" },
];

export function AboutPage() {
  return (
    <article className={`${styles.container} fade-in`}>
      <header className={styles.hero}>
        <span className={styles.chapterLabel}>Chapter 01 — Origin Story</span>
        <h1 className={styles.title}>
          Built by a manga <span className={styles.accent}>enthusiast.</span>
        </h1>
      </header>

      <section className={styles.section}>
        <p className={styles.lead}>
          Hi, welcome to my manga tracking app! My name is Shriyash, a fellow
          manga enthusiast with ADHD who likes to read multiple manga
          concurrently. In doing so I sometimes forget where I left off, and end
          up scrolling through 50 different chapters to figure out where I left
          things last time. I can read as many mangas as I want at the same
          time, while also keeping a record of where I left off so I can come
          back next time and start right where I want to.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What feeeature does it have, you ask?</h2>
        <p>
          Oh good thing you asked. Go back in time and try to remember that
          conversation with your friend when they asked you what your favourite
          manga was, and you just froze not knowing which to pick because you
          forget which one was the peak? Worry not, I've solved that problem for
          you by adding a rating feature that lets you rate the manga you're
          currently reading or have read, so next time someone asks you what
          your favourite manga is you won't be frozen like Tempus (Eva Bell)
          from X-Men.
        </p>
      </section>

      <section className={styles.section}>
        <h2>The Stack</h2>
        <div className={styles.techRow}>
          {STACK.map((t) => (
            <div key={t.name} className={styles.techCard}>
              <span className={styles.techName}>{t.name}</span>
              <span className={styles.techRole}>{t.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Changelog</h2>
        <div className={styles.wipBar}>
          <span className={styles.wipDot} />
          <p>
            <strong>Update:</strong> Authentication has been added. Now you can
            create your <strong>own</strong> account to track your{" "}
            <strong>personal</strong> list of mangas ;&#41;
          </p>
        </div>
        <div className={styles.wipBar}>
          <span className={styles.wipDotUpcoming} />
          <p>
            <strong>Coming soon:</strong> Search any <strong>Manga</strong>{" "}
            title and compare <strong>prices</strong> across stores in your
            region so you never overpay for your fav mangas!
          </p>
        </div>
      </section>

      <div className={styles.cta}>
        <NavLink to="/" className="btn btn-primary btn-lg" viewTransition>
          Okay, let me try it
        </NavLink>
      </div>
    </article>
  );
}

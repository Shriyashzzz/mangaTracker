import { useEffect } from "react";
import styles from "./About.module.css";

export function AboutPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  });
  return (
    <div className={styles.container}>
      <div className={styles.containerBox}>
        <span className={styles.chapterLabel}>Chapter 01 — Origin Story</span>
        <h1 className={styles.title}>
          Built by a manga <span className={styles.accent}>enthusiast.</span>
        </h1>

        <div className={styles.section}>
          <p>
            Hi, welcome to my manga tracking app! My name is Shriyash, a fellow
            manga enthusiast with ADHD who likes to read multiple manga
            concurrently. In doing so I sometimes forget where I left off, and
            end up scrolling through 50 different chapters to figure out where I
            left things last time. I can read as many mangas as I want at the
            same time, while also keeping a record of where I left off so I can
            come back next time and start right where I want to.
          </p>
        </div>

        <div className={styles.section}>
          <h2>What feeeature does it have, you ask?</h2>
          <p>
            Oh good thing you asked. Go back in time and try to remember that
            conversation with your friend when they asked you what your
            favourite manga was, and you just froze not knowing which to pick
            because you forget which one was the peak? Worry not, I've solved
            that problem for you by adding a rating feature that lets you rate
            the manga you're currently reading or have read, so next time
            someone asks you what your favourite manga is you won't be frozen
            like Tempus (Eva Bell) from X-Men.
          </p>
        </div>

        <div className={styles.section}>
          <h2>The Stack</h2>
          <div className={styles.techRow}>
            <div className={styles.techCard}>
              <span className={styles.techName}>React</span>
              <span className={styles.techRole}>Frontend</span>
            </div>
            <div className={styles.techCard}>
              <span className={styles.techName}>Express</span>
              <span className={styles.techRole}>Backend</span>
            </div>
            <div className={styles.techCard}>
              <span className={styles.techName}>PostgreSQL</span>
              <span className={styles.techRole}>Database</span>
            </div>
            <div className={styles.techCard}>
              <span className={styles.techName}>React Router</span>
              <span className={styles.techRole}>FE Routing</span>
            </div>
            <div className={styles.techCard}>
              <span className={styles.techName}>Vite</span>
              <span className={styles.techRole}>Bundler</span>
            </div>
            <div className={styles.techCard}>
              <span className={styles.techName}>Material UI</span>
              <span className={styles.techRole}>Components</span>
            </div>
          </div>
        </div>

        <div className={styles.wipBar}>
          <span className={styles.wipDot} />
          <p>
            <strong>Work in progress.</strong> Authentication is coming soon -
            After that, each person gets their own collection. For now this is
            my library, but you're welcome to add yours too, don't be sad it's
            still a WIP ;&#41;
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { QUOTES } from "../../lib/quotes";
import styles from "./Footer.module.css";

// start somewhere different on each visit
const START = Math.floor(Math.random() * QUOTES.length);

// the last page of a manga volume: a sign-off, a parting line, the colophon
export default function Footer() {
  const { pathname } = useLocation();
  // every page you open turns to the next quote in the loop
  const [page, setPage] = useState({ path: pathname, index: START });
  if (page.path !== pathname) {
    setPage({ path: pathname, index: (page.index + 1) % QUOTES.length });
  }

  const quote = QUOTES[page.index];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.tbc}>Quote of the day</p>

        <figure className={styles.quote}>
          {/* keyed so each new quote fades in */}
          <div key={page.index} className={styles.quoteText}>
            <blockquote>{quote.text}</blockquote>
            <figcaption>
              {quote.who}, <cite>{quote.series}</cite>
            </figcaption>
          </div>
        </figure>

        <p className={styles.links}>
          <NavLink to="/about">About</NavLink>
          <span aria-hidden>·</span>
          <span>Vol. 1, {new Date().getFullYear()}</span>
        </p>
      </div>
    </footer>
  );
}

import { NavLink } from "react-router";
import { QUOTES } from "../../lib/quotes";
import styles from "./Footer.module.css";

// one quote per calendar day, the same for everyone, turning over at local
// midnight. Counting whole days keeps it walking through the list in order
const quoteOfTheDay = (date = new Date()) => {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
  return QUOTES[day % QUOTES.length];
};

// the last page of a manga volume: a sign-off, a parting line, the colophon
export default function Footer() {
  const quote = quoteOfTheDay();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.tbc}>Quote of the day</p>

        <figure className={styles.quote}>
          <div className={styles.quoteText}>
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

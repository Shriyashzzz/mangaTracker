import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QUOTES } from "../../lib/quotes";
import Mascot from "../mascot/Mascot";
import styles from "./SlowLoadQuote.module.css";

const SHOW_AFTER_MS = 1000;
const NEXT_QUOTE_MS = 5000;

// sits on top of a loading skeleton. Quick loads never see it; a slow one
// (a big series, a cold price check) gets a quote to read meanwhile, and a
// new one every few seconds after that. Rendered into <body> so it stays
// pinned to the window whatever the skeleton's container is doing
export default function SlowLoadQuote() {
  const [shown, setShown] = useState(false);
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * QUOTES.length),
  );

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % QUOTES.length),
      NEXT_QUOTE_MS,
    );
    return () => clearInterval(timer);
  }, [shown]);

  if (!shown) return null;
  const quote = QUOTES[index];

  return createPortal(
    <div className={`printed ${styles.panel}`}>
      <span className={styles.mascot} aria-hidden>
        <Mascot mood="happy" />
      </span>
      <div>
        <p className={styles.lead} role="status">
          Taking a moment. One to read while you wait:
        </p>
        <figure key={index} className={styles.quote}>
          <blockquote>{quote.text}</blockquote>
          <figcaption>
            {quote.who}, <cite>{quote.series}</cite>
          </figcaption>
        </figure>
      </div>
    </div>,
    document.body,
  );
}

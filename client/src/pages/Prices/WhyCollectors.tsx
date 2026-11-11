// For someone new on the home page: what Manga Tracker does that a price
// list doesn't, in four panels, each with a way to see it for themselves.
// Only what the app does today. The site server writes the same words for
// search engines (client/server.ts homeTags)
import { NavLink } from "react-router";
import { WHY_COLLECTORS } from "../../lib/whyCollectors";
import { pricesStyles as styles } from "./styles";

export default function WhyCollectors() {
  return (
    <section aria-labelledby="why-title" className={styles.why}>
      <h2 id="why-title" className={styles.sectionTitle}>
        Why collectors use it
      </h2>
      <ol className={styles.whyPanels}>
        {WHY_COLLECTORS.map((w) => (
          <li key={w.title} className={styles.whyPanel}>
            <h3 className={styles.whyTitle}>{w.title}</h3>
            <p className={styles.whyBody}>{w.body}</p>
            <NavLink to={w.link} className={styles.whyLink} viewTransition>
              {w.label} →
            </NavLink>
          </li>
        ))}
      </ol>
    </section>
  );
}

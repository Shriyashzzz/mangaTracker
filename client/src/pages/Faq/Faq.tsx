// Questions and answers. The words live in lib/content/faq.ts, which the
// site's server reads too, so a search engine sees the same page.
import { NavLink } from "react-router";
import { FAQ, FAQ_DESCRIPTION, faqJsonLd } from "../../lib/content/faq";
import { usePageMeta } from "../../lib/seo";
import { faqStyles as styles } from "./styles";

export function FaqPage() {
  usePageMeta({
    title: "FAQ",
    description: FAQ_DESCRIPTION,
    path: "/faq",
    jsonLd: faqJsonLd(),
  });

  return (
    <article className={`${styles.page} fade-in`}>
      <header>
        <h1 className={styles.title}>
          Got a <span className={styles.hit}>question?</span>
        </h1>
        <p className={styles.lead}>
          Short answers to what people ask most. Tap a question to open it.
        </p>
      </header>

      {FAQ.map((group) => (
        <section key={group.name} aria-labelledby={`faq-${group.name}`}>
          <h2 id={`faq-${group.name}`} className={styles.groupName}>
            {group.name}
          </h2>
          <div className={styles.list}>
            {group.questions.map(({ q, a }) => (
              <details key={q} className={styles.item}>
                <summary className={styles.question}>
                  {q}
                  <span className={styles.mark} aria-hidden />
                </summary>
                <p className={styles.answer}>{a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className={styles.more}>
        Want the story behind the site?{" "}
        <NavLink to="/about" viewTransition>
          Read about Manga Tracker
        </NavLink>
        , or see{" "}
        <NavLink to="/updates" viewTransition>
          what's new
        </NavLink>
        .
      </p>
    </article>
  );
}

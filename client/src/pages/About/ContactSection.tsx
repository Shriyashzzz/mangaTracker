// "Feedback or questions?": the way to reach the developer, with the
// email written out, and the credits under it. On the About page and the
// FAQ (the App Store's support link opens either, and it must show how to
// get in touch). The coffee ask is never shown inside the Google Play app
import { NavLink } from "react-router";
import { CoffeeIcon } from "../../components/icons/Icons";
import { CONTACT_EMAIL } from "../../lib/contact";
import { inPlayApp } from "../../lib/playApp";
import { SUPPORT_URL, stopAsking } from "../../lib/support";
import { aboutStyles as styles } from "./styles";

export default function ContactSection() {
  return (
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
      <NavLink to="/acknowledgements" className={styles.credits} viewTransition>
        Acknowledgements
      </NavLink>
      <NavLink to="/privacy" className={styles.credits} viewTransition>
        Privacy policy
      </NavLink>
    </section>
  );
}

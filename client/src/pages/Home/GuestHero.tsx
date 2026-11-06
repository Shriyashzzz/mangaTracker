import { NavLink } from "react-router";
import { StarIcon } from "../../components/icons/Icons";
import TakeTourButton from "../../components/tour/TakeTourButton";
import { homeStyles as styles } from "./styles";

// the shelf for someone not signed in: what it does, as a page of manga panels
export default function GuestHero() {
  return (
    <>
      <div className={`${styles.guestContainer} fade-in`}>
        <div className={styles.guestCopy}>
          <h1 className={styles.guestTitle}>
            Your <span className={styles.titleHit}>shelf</span> lives here once
            you sign up.
          </h1>
          <p className={styles.guestSub}>
            Keep your place in every series, track the volumes you own, and see
            when the next one's out and what it costs.
          </p>
          <div className={styles.guestActions}>
            <NavLink
              to="/signup"
              className="btn btn-primary upto-720: p-3 "
              viewTransition
            >
              Start your shelf
            </NavLink>
            <NavLink
              to="/signin"
              className="btn p-3 upto-720:hidden "
              viewTransition
            >
              Sign in
            </NavLink>
            <TakeTourButton />
          </div>
        </div>

        {/* a manga page: one panel per thing the app does */}
        <ol className={`${styles.page} printed`} aria-label="What you can do">
          <li className={styles.panelWide}>
            <div className={`${styles.art} ${styles.speed}`} aria-hidden>
              <span className={styles.bigCh}>
                <small>ch.</small>374
              </span>
            </div>
            <span className={`${styles.sfx} ${styles.sfxA}`} aria-hidden>
              Bookmarked!
            </span>
            <p className={styles.caption}>Save the chapter you're on</p>
          </li>

          <li className={styles.panel}>
            <div className={`${styles.art} ${styles.tone}`} aria-hidden>
              <span className={styles.panelStars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarIcon key={n} filled />
                ))}
              </span>
            </div>
            <span className={`${styles.sfx} ${styles.sfxB}`} aria-hidden>
              Peak!
            </span>
            <p className={styles.caption}>Rate what you finish</p>
          </li>

          <li className={styles.panel}>
            <div className={`${styles.art} ${styles.tone}`} aria-hidden>
              <span className={styles.covers}>
                <span>Vol. 1</span>
                <span>Vol. 2</span>
                <span>Vol. 3</span>
              </span>
            </div>
            <span className={`${styles.sfx} ${styles.sfxC}`} aria-hidden>
              Found it!
            </span>
            <p className={styles.caption}>Covers and genres fill in</p>
          </li>

          <li className={styles.panelWide}>
            <div className={`${styles.art} ${styles.tone}`} aria-hidden>
              <span className={styles.bigCh}>
                <small>vol.</small>25
              </span>
            </div>
            <span className={`${styles.sfx} ${styles.sfxD}`} aria-hidden>
              It's out!
            </span>
            <p className={styles.caption}>See which series have new volumes</p>
          </li>
        </ol>
      </div>
    </>
  );
}

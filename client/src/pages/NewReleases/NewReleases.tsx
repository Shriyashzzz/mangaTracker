// How the shelf's New tab works: where the news comes from, and for anyone
// signed in, what they want listed.
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import { usePageMeta } from "../../lib/seo";
import { useReleaseChecksOn } from "../../lib/prefs";
import { openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import { newReleasesStyles as styles } from "./styles";

const SOURCES = [
  {
    name: "English volumes",
    body: "From a US book catalog, so they're editions you can actually buy here.",
  },
  {
    name: "English chapters",
    body: "From MangaDex and MangaUpdates, using whichever is furthest along. MangaUpdates doesn't say which language a chapter is in, so a chapter may still be on its way in English.",
  },
  {
    name: "In Japan",
    body: "Volumes only, from the Japanese covers on MangaDex. We can't show Japanese chapters, because none of these sites track them.",
  },
];

export default function NewReleasesPage() {
  usePageMeta({
    title: "How the New tab works",
    description:
      "Where Manga Tracker finds new English volumes, chapters and Japanese volumes, and how to choose what shows up on your shelf.",
    path: "/new-releases",
  });
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const checksOn = useReleaseChecksOn();

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          How <span className={styles.hit}>new</span> works
        </h1>
        <span className={styles.kenji} aria-hidden>
          <Mascot mood="happy" />
        </span>
      </header>

      <section className={styles.section} aria-labelledby="new-sources">
        <h2 id="new-sources" className={styles.heading}>
          Where the news comes from
        </h2>
        <ul className={styles.sources}>
          {SOURCES.map((source) => (
            <li key={source.name} className={styles.source}>
              <h3 className={styles.sourceName}>{source.name}</h3>
              <p>{source.body}</p>
            </li>
          ))}
        </ul>
        <p>
          We compare those with where you are: the volumes you own, or else the
          chapter you're on. A series with neither saved can't show up, because
          we can't tell what's next for you.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="new-choose">
        <h2 id="new-choose" className={styles.heading}>
          What you'll see
        </h2>
        <p>
          Out of the box you see the next volume you can buy, however far behind
          you are, and the next chapter once you're within 3 of the latest.
        </p>
        <p>
          Volumes and chapters each have their own setting: just the next one,
          only when you're within a number you choose, or everything that's out.
          The volume one covers English and In Japan, each measured against its
          own newest volume.
        </p>
        {isSignedIn ? (
          <NavLink
            to="/settings/new-releases"
            className="btn btn-secondary self-start"
            viewTransition
          >
            Change this in settings
          </NavLink>
        ) : (
          isSignedIn === false && (
            <NavLink to="/signup" className="btn btn-primary self-start" viewTransition>
              Start your shelf
            </NavLink>
          )
        )}
      </section>

      <section className={styles.section} aria-labelledby="new-hide">
        <h2 id="new-hide" className={styles.heading}>
          Hiding things
        </h2>
        <p>
          Hide clears something from the list until something newer is out.
          Anything you've hidden stays under Hidden on the New tab, where you can
          unhide it, or everything at once.
        </p>
        {isSignedIn && checksOn && (
          <NavLink
            to="/shelf"
            className="btn btn-secondary self-start"
            onClick={openReleasesOnShelf}
            viewTransition
          >
            See what's new
          </NavLink>
        )}
      </section>

      <section className={styles.section} aria-labelledby="new-off">
        <h2 id="new-off" className={styles.heading}>
          When a number looks off
        </h2>
        <p>
          These sites don't always agree, and some lose chapters when a series
          gets licensed, so a count can run low for a while. We check each
          series at most every 6 hours, so something brand new can take a
          little while to appear.
        </p>
      </section>
    </article>
  );
}

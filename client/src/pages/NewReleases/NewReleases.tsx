// How the shelf's New tab works: what it's for, how it knows, and for anyone signed
// in, what they want listed.
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import { usePageMeta } from "../../lib/seo";
import { useReleaseChecksOn } from "../../lib/prefs";
import { openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import { newReleasesStyles as styles } from "./styles";

const HOW_IT_WORKS = [
  {
    name: "1. You save your place",
    body: "The volumes you own, or else the chapter you're on. A series with neither saved can't show up, because we can't tell what's next for you.",
  },
  {
    name: "2. We check what's out",
    body: "We look up each series at most every 6 hours, so something brand new can take a little while to appear.",
  },
  {
    name: "3. New tells you",
    body: "Anything past your place lands on the New tab, so you don't have to go checking.",
  },
];

const KINDS = [
  {
    name: "Volumes",
    body: "English volumes you can actually buy here, from a US book catalog.",
  },
  {
    name: "Chapters",
    body: "English chapters, from MangaDex and MangaUpdates, whichever is furthest along. MangaUpdates doesn't say which language a chapter is in, so one may still be on its way in English.",
  },
  {
    name: "In Japan",
    body: "Japanese volumes, from the covers on MangaDex. No chapters here, because none of these sites track Japanese ones.",
  },
];

export default function NewReleasesPage() {
  usePageMeta({
    title: "How the New tab works",
    description:
      "The New tab tells you when a volume or chapter past your place is out. How it knows, where the news comes from, and how to choose what shows up.",
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

      <p className={styles.lead}>
        New watches every series on your shelf and tells you when a volume or
        chapter past your place is out.
      </p>

      <section className={styles.section} aria-labelledby="new-how">
        <h2 id="new-how" className={styles.heading}>
          How it knows
        </h2>
        {/* role: Safari stops announcing a list once its bullets are styled away */}
        <ol role="list" className={styles.sources}>
          {HOW_IT_WORKS.map((part) => (
            <li key={part.name} className={styles.source}>
              <h3 className={styles.sourceName}>{part.name}</h3>
              <p>{part.body}</p>
            </li>
          ))}
        </ol>
        <p className={styles.example}>
          You own a series up to vol. 40, and vol. 41 comes out. New shows it as
          "Vol. 41 is out".
        </p>
      </section>

      <section className={styles.section} aria-labelledby="new-kinds">
        <h2 id="new-kinds" className={styles.heading}>
          What's on the tab
        </h2>
        <ul role="list" className={styles.sources}>
          {KINDS.map((kind) => (
            <li key={kind.name} className={styles.source}>
              <h3 className={styles.sourceName}>{kind.name}</h3>
              <p>{kind.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="new-choose">
        <h2 id="new-choose" className={styles.heading}>
          Too much or too little?
        </h2>
        <p>
          To start, you see the next volume you can buy, however far behind you
          are, and the next chapter once you're within 3 of the latest.
        </p>
        <p>
          You can change that, for volumes and chapters separately: just the
          next one, only when you're within a number you choose, or everything
          that's out. The volume setting covers English and In Japan, each
          against its own newest volume.
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
            <NavLink
              to="/signup"
              className="btn btn-primary self-start"
              viewTransition
            >
              Start your shelf
            </NavLink>
          )
        )}
      </section>

      <section className={styles.section} aria-labelledby="new-hide">
        <h2 id="new-hide" className={styles.heading}>
          Already got it?
        </h2>
        <p>
          Hide takes something off the list until something newer is out. You'll
          find it under Hidden on the New tab, where you can bring back one or
          everything.
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
          gets licensed, so a count can run low for a while.
        </p>
      </section>
    </article>
  );
}

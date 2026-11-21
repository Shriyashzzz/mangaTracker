// How the shelf's New tab works, shown rather than told: who it's for and
// one sentence, a three-panel strip that shows it happen, the questions
// people ask (each with the card New would show), the piles a long list is
// sorted into drawn as the tab draws them, and the settings themselves,
// right on the page. Where the news comes from is folded under "More about New".
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import {
  NEW_RELEASES_DESCRIPTION,
  NEW_RELEASES_TITLE,
} from "../../lib/content/newReleases";
import { usePageMeta } from "../../lib/seo";
import { useReleaseChecksOn } from "../../lib/prefs";
import { openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import { PILES_FROM } from "../Home/piles";
import CardSketch from "./CardSketch";
import PilesPicture from "./PilesPicture";
import ReleaseControls from "./ReleaseControls";
import { newReleasesStyles as styles } from "./styles";

// "See what New shows by default, or change it": down to the defaults and
// the settings at the foot of the page.
// The router keeps a plain #link from scrolling, so it's done here
const toSettings = (e: { preventDefault: () => void }) => {
  e.preventDefault();
  document.getElementById("new-choose")?.scrollIntoView({ block: "start" });
};

// What people ask next, each answered in a line. The phrases in bold are
// the tab's own (Home/shelfViews.ts): always what's next for them, and how
// far behind they are
const QUESTIONS = [
  // the first thing a new reader needs: how a series gets onto New
  {
    ask: "Don't see a series?",
    answer:
      "Add it to your shelf first. Then mark the volumes you own, or the chapter you've read up to.",
  },
  {
    // the case the strip above draws, said in words
    ask: "All caught up?",
    answer: (
      <>
        When the newest volume comes out, New says <b>“Vol. 15 next”</b>.
      </>
    ),
  },
  {
    // it's about their place, not the calendar: said plainly, because "new"
    // sounds like "released this week". Behind counts every volume that's
    // out and isn't theirs, the newest included (Home/piles.ts)
    ask: "Behind?",
    answer: (
      <>
        Say you own vol. 12, and 13 and 14 are out. New says{" "}
        <b>“Vol. 13 next”</b>, with <b>“2 volumes behind”</b> under it.
        <CardSketch
          cover="13"
          news="Vol. 13 next"
          behind="2 volumes behind"
          yours="You own up to vol. 12"
          label="A New card: Vol. 13 next, 2 volumes behind, you own up to vol. 12"
        />
      </>
    ),
  },
  {
    // the Chapters list (Home/ReleaseModal.tsx): near the newest by
    // default, and a card opens the English books that hold the chapters
    ask: "Reading by the chapter?",
    answer: (
      <>
        By default, the <b>Chapters</b> list shows your next chapter once you're
        within 3 of the newest. You can{" "}
        <a href="#new-choose" className={styles.link} onClick={toSettings}>
          change it right here
        </a>
        .
        <span className={styles.nextLine}>
          The card also says which volume your chapter is in. Tap it to see
          which English volume has your next chapter.
        </span>
        <CardSketch
          cover="15"
          news="Ch. 101 next"
          behind="2 chapters behind"
          yours="Read up to ch. 100 · vol. 14"
          opens="Tap it and New shows: Vol. 15 has ch. 101–115, with its prices."
          label="A Chapters card: ch. 101 next, 2 chapters behind, read up to ch. 100 in vol. 14. Tapped, it shows vol. 15 holds ch. 101 to 115, with its prices"
        />
      </>
    ),
  },
  {
    // the In Japan list only starts for a series once English runs out
    ask: "Caught up with English?",
    answer: (
      <>
        New has an <b>In Japan</b> list too: volumes out in Japan that may not
        be in English yet.
        <span className={styles.nextLine}>
          It works like the English lists, but we can't link to Japanese manga
          or book stores yet.
        </span>
        <CardSketch
          cover="30"
          news="Vol. 30 in Japan"
          yours="You own up to vol. 29"
          label="An In Japan card: vol. 30 in Japan, you own up to vol. 29"
        />
      </>
    ),
  },
  {
    // what's coming: the red bar at the top of the tab
    ask: "Not out yet?",
    answer: (
      <>
        The red <b>Upcoming Releases</b> bar at the top of New lists volumes
        that aren't out yet, with the day each one comes out.
      </>
    ),
  },
  {
    ask: "Already seen it?",
    answer: (
      <>
        Tap <b>Hide</b>.
        <span className={styles.nextLine}>
          It leaves the list until something newer is out, and waits under{" "}
          <b>Hidden</b>.
        </span>
      </>
    ),
  },
];

// For a visitor with no shelf yet: the choices the settings give, under
// the settings' own names (ReleaseControls.tsx), each with what it would
// show the same reader. Someone signed in gets the real controls instead
const CHOICES = [
  { name: "Every series", note: "The default.", shows: "Vol. 23." },
  {
    name: "Only series I'm nearly caught up on",
    note: "You pick how close.",
    shows: "Nothing yet: you're 8 behind.",
  },
];

export default function NewReleasesPage() {
  usePageMeta({
    title: NEW_RELEASES_TITLE,
    description: NEW_RELEASES_DESCRIPTION,
    path: "/new-releases",
  });
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const checksOn = useReleaseChecksOn();

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            How <span className={styles.hit}>new</span> works
          </h1>
          {/* who it's for, said small under the title */}
          <p className={styles.tagline}>
            Made for collectors: fill the gaps in your collection, and see
            what's new and what's coming.
          </p>
        </div>
        <span className={styles.kenji} aria-hidden>
          <Mascot mood="happy" />
        </span>
      </header>

      <div className={styles.intro}>
        <p className={styles.lead}>
          The New tab on your shelf shows the next volume to collect.
        </p>
      </div>

      {/* the strip, with the one change most want just above it */}
      <div className={styles.stripGroup}>
        {/* the first thing to change, a jump down to the settings */}
        <p className={styles.sub}>
          Only want new releases?{" "}
          <a href="#new-choose" className={styles.link} onClick={toSettings}>
            See what New shows by default, or change it
          </a>
        </p>
        {/* the idea, happening: three panels read left to right */}
        <ol role="list" className={styles.strip}>
          <li className={styles.panelBox}>
            <span className={styles.panelNumber}>1</span>
            <span className={styles.panelArt} aria-hidden>
              <span className={styles.book}>14</span>
              <span className={styles.yours}>Yours</span>
            </span>
            <p>You own vol. 14.</p>
          </li>
          <li className={styles.panelBox}>
            <span className={styles.panelNumber}>2</span>
            <span className={styles.panelArt} aria-hidden>
              <span className={styles.book}>
                15
                <span className={styles.stamp}>Out!</span>
              </span>
              {/* as tall as "Yours" beside it, so the two books sit level */}
              <span className={styles.yours}>&nbsp;</span>
            </span>
            <p>Vol. 15 comes out.</p>
          </li>
          <li className={styles.panelBox}>
            <span className={styles.panelNumber}>3</span>
            <span className={styles.panelArt} aria-hidden>
              <span className={styles.newTab}>
                New <small>1</small>
              </span>
              <span className={styles.news}>Vol. 15 next</span>
            </span>
            <p>New tells you.</p>
          </li>
        </ol>
      </div>

      {/* role: Safari stops announcing a list once its bullets are styled away */}
      <dl className={styles.questions}>
        {QUESTIONS.map((one) => (
          <div key={one.ask} className={styles.question}>
            <dt>{one.ask}</dt>
            <dd>{one.answer}</dd>
          </div>
        ))}
      </dl>

      {/* how a long list is laid out: the piles' own names and reasons, as
          the tab shows them (Home/piles.ts) */}
      <section className={styles.section} aria-labelledby="new-piles">
        <h2 id="new-piles" className={styles.heading}>
          A lot of news? It's sorted into piles
        </h2>
        <p>
          With {PILES_FROM} or more series on New, or any far behind, they're
          grouped by how far behind you are. "See all" opens a pile.
        </p>
        <PilesPicture />
      </section>

      <section className={styles.sectionPlain} aria-labelledby="new-choose">
        {/* "Change what New shows" lands here, with room above it */}
        <h2 id="new-choose" className={`${styles.heading} scroll-mt-6`}>
          Don't like how it works?
        </h2>
        {/* what New does before anyone changes it (server
            releaseStatus.ts DEFAULT_RELEASE_SETTINGS), one list a line */}
        <div className={styles.defaults}>
          <p>By default, New shows:</p>
          <ul>
            <li>
              <b>Volumes:</b> the next volume of every series, however far
              behind you are.
            </li>
            <li>
              <b>Chapters:</b> your next chapter once you're within 3 of the
              newest.
            </li>
            <li>
              <b>In Japan:</b> the newest volume out in Japan, once you're
              caught up with English.
              <span className={styles.nextLine}>
                It shows what's already out there, waiting to be translated.
              </span>
            </li>
          </ul>
        </div>
        {isSignedIn && checksOn && (
          <>
            <p>
              Change it right here. These are your settings: it saves as you go.
            </p>
            <ReleaseControls />
          </>
        )}
        {isSignedIn && !checksOn && (
          <>
            <p>New is switched off for your shelf.</p>
            <NavLink
              to="/settings/new-releases"
              className="btn btn-secondary self-start"
              viewTransition
            >
              Turn it on in settings
            </NavLink>
          </>
        )}
        {isSignedIn === false && (
          <>
            <p>
              With a shelf of your own, you choose what New lists, in its
              settings. Say you own up to vol. 22, and vol. 30 is out:
            </p>
            <ul role="list" className={styles.choices}>
              {CHOICES.map((choice) => (
                <li key={choice.name} className={styles.choice}>
                  <span className={styles.choiceName}>{choice.name}</span>
                  {choice.note && (
                    <span className={styles.choiceNote}>{choice.note}</span>
                  )}
                  <span className={styles.choiceShows}>
                    New shows: <b>{choice.shows}</b>
                  </span>
                </li>
              ))}
            </ul>
            <NavLink
              to="/signup"
              className="btn btn-primary self-start"
              viewTransition
            >
              Start your shelf
            </NavLink>
          </>
        )}
      </section>

      {/* read it all: off to the tab itself */}
      {isSignedIn && checksOn && (
        <NavLink
          to="/shelf"
          className="btn btn-primary self-start"
          onClick={openReleasesOnShelf}
          viewTransition
        >
          See what's new
        </NavLink>
      )}

      <details className={styles.more}>
        <summary className={styles.moreSummary}>More about New</summary>
        <div className={styles.moreBody}>
          <section className={styles.finePrint} aria-labelledby="new-from">
            <h2 id="new-from" className={styles.smallHeading}>
              Where the news comes from
            </h2>
            <ul>
              <li>Volumes: a US book catalog.</li>
              <li>
                Chapters: MangaDex and MangaUpdates, whichever is further along.
                MangaUpdates doesn't say which language a chapter is in, so one
                may still be on its way in English.
              </li>
              <li>
                In Japan: the covers on MangaDex. No chapters, because none of
                these sites track Japanese ones.
              </li>
            </ul>
            <p>
              We check each series every 6 hours, so brand-new news can take a
              little while. These sites don't always agree, and some lose
              chapters when a series gets licensed, so a count can run low for a
              while.
            </p>
          </section>
        </div>
      </details>
    </article>
  );
}

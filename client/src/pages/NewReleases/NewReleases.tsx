// How the shelf's New tab works, kept short: one sentence, a three-panel
// strip that shows it happen, the questions people ask, Upcoming Releases,
// the piles a long list is sorted into, and the settings
// themselves, right on the page, for anyone who wants it to work another
// way. The rest (a picture of the tab with its parts named, and where the
// news comes from) is folded under "More about New".
import { NavLink } from "react-router";
import { CheckIcon } from "../../components/icons/Icons";
import Mascot from "../../components/mascot/Mascot";
import { usePageMeta } from "../../lib/seo";
import { useReleaseChecksOn } from "../../lib/prefs";
import { openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import { PILES, PILES_FROM, PILE_TEXT } from "../Home/piles";
import NewTabPicture from "./NewTabPicture";
import ReleaseControls from "./ReleaseControls";
import { newReleasesStyles as styles } from "./styles";
import UpcomingPicture from "./UpcomingPicture";

// What people ask next, each answered in a line. The phrases in bold are
// the tab's own (Home/shelfViews.ts): always what's next for them, and how
// far behind they are
const QUESTIONS = [
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
      </>
    ),
  },
  {
    ask: "Far behind?",
    answer: "The same. New shows your next volume however far back it is.",
  },
  {
    ask: "Already seen it?",
    answer: (
      <>
        Tap <b>Hide</b>.
      </>
    ),
  },
  {
    ask: "Don't see a series?",
    answer:
      "Add it to your shelf first. Then mark the volumes you own, or the chapter you're on.",
  },
];

// For a visitor with no shelf yet: the choices the settings give, under
// the settings' own names (ReleaseControls.tsx), each with what it would
// show the same reader. Someone signed in gets the real controls instead
const CHOICES = [
  { name: "Every series", note: "How it starts.", shows: "Vol. 23." },
  {
    name: "Only series I'm nearly caught up on",
    note: "You pick how close.",
    shows: "Nothing yet: you're 8 behind.",
  },
];

export default function NewReleasesPage() {
  usePageMeta({
    title: "How the New tab works",
    description:
      "The New tab shows the next volume for every manga on your shelf. You own vol. 14, vol. 15 comes out, New tells you. How to change what it lists.",
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
        New shows the next volume for every manga on your shelf.
      </p>

      {/* the idea, happening: three panels read left to right */}
      <ol role="list" className={styles.strip}>
        <li className={styles.panelBox}>
          <span className={styles.panelNumber}>1</span>
          <span className={styles.panelArt} aria-hidden>
            <span className={styles.book}>14</span>
            <span className={styles.yours}>
              <CheckIcon className="size-3.5" />
              Yours
            </span>
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

      {/* role: Safari stops announcing a list once its bullets are styled away */}
      <dl className={styles.questions}>
        {QUESTIONS.map((one) => (
          <div key={one.ask} className={styles.question}>
            <dt>{one.ask}</dt>
            <dd>{one.answer}</dd>
          </div>
        ))}
      </dl>

      {/* the bar at the top of the tab: what isn't out yet */}
      <section className={styles.section} aria-labelledby="new-upcoming">
        <h2 id="new-upcoming" className={styles.heading}>
          Not out yet? Upcoming Releases
        </h2>
        <p>
          The red bar at the top of New lists English volumes that aren't out
          yet, for the series on your shelf, with the day each one comes out.
          Opened, it looks like this:
        </p>
        <UpcomingPicture />
        {isSignedIn && (
          <NavLink
            to="/calendar"
            className="btn btn-secondary self-start"
            viewTransition
          >
            See the full calendar
          </NavLink>
        )}
      </section>

      {/* how a long list is laid out: the piles' own names and reasons, as
          the tab shows them (Home/piles.ts) */}
      <section className={styles.section} aria-labelledby="new-piles">
        <h2 id="new-piles" className={styles.heading}>
          A lot of news? It's sorted into piles
        </h2>
        <p>
          With {PILES_FROM} or more series on New, they're grouped by how far
          behind you are. "See all" opens a pile.
        </p>
        <dl className={styles.questions}>
          {PILES.map((pile) => (
            <div key={pile} className={styles.question}>
              <dt>{PILE_TEXT.volumes[pile].name}</dt>
              <dd>{PILE_TEXT.volumes[pile].why}</dd>
            </div>
          ))}
        </dl>
      </section>

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

      <section className={styles.section} aria-labelledby="new-choose">
        <h2 id="new-choose" className={styles.heading}>
          Don't like how it works?
        </h2>
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
              settings. Say you've finished vol. 22, and vol. 30 is out:
            </p>
            <ul role="list" className={styles.choices}>
              {CHOICES.map((choice) => (
                <li key={choice.name} className={styles.choice}>
                  <span className={styles.choiceName}>
                    <span className={styles.radio} aria-hidden />
                    {choice.name}
                  </span>
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

      <details className={styles.more}>
        <summary className={styles.moreSummary}>More about New</summary>
        <div className={styles.moreBody}>
          <section className={styles.section} aria-labelledby="new-tab">
            <h2 id="new-tab" className={styles.heading}>
              What's on the tab
            </h2>
            <NewTabPicture />
          </section>
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

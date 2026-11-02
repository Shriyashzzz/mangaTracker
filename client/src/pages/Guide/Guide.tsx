// A short tour of everything the app does, one manga panel per stop, each with a
// real link to try it. Add a stop here when a big feature ships.
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import { seriesPath } from "../../lib/prices";
import { usePageMeta } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { aboutStyles as about } from "../About/styles";
import { guideStyles as styles } from "./styles";

const START = { to: "/signup", label: "Start your shelf" };

export function GuidePage() {
  usePageMeta({
    title: "Take the tour",
    description:
      "Everything Manga Tracker does: keep your place in every series, compare US manga prices, catch new releases and bring your list over from MyAnimeList.",
    path: "/guide",
  });
  const isSignedIn = useAuth((s) => s.isSignedIn);
  // pages that need an account send guests to make one
  const ifSignedIn = (to: string, label: string) =>
    isSignedIn ? { to, label } : START;

  const stops = [
    {
      art: about.doesTone,
      big: "Shelf",
      small: "sample",
      sfx: "Peek!",
      title: "Look around",
      note: "See a real shelf with no account needed. Tap Read notes on a manga to see what its reader wrote.",
      link: { to: "/u/sample", label: "Open the sample shelf" },
    },
    {
      art: about.doesLines,
      big: "327",
      small: "ch.",
      sfx: "Saved!",
      title: "Keep your place",
      note: "Add a manga by title, and the cover and genre fill in. Its page saves your chapter, rating, notes and the volumes you own.",
      link: ifSignedIn("/add", "Add a manga"),
    },
    {
      art: about.doesTone,
      big: "$8",
      sfx: "Deal!",
      title: "Find the cheapest copy",
      note: "Open any volume to compare what US stores charge, new and used, with its price history.",
      link: { to: seriesPath("One Piece"), label: "Try it on One Piece" },
    },
    {
      art: about.doesLines,
      big: "12",
      small: "vol.",
      sfx: "New!",
      title: "Catch new releases",
      note: "The New tab shows which series on your shelf have a new volume or chapter out. You choose how much it lists, and can hide what you've seen.",
      link: { to: "/new-releases", label: "See how New works" },
    },
    {
      art: about.doesTone,
      big: "List",
      small: "your",
      sfx: "Whoosh!",
      title: "Bring your list",
      note: "Coming from MyAnimeList? Upload your export file and your manga come over in one go.",
      link: ifSignedIn("/import", "Import my list"),
    },
    {
      art: about.doesLines,
      mascot: true,
      sfx: "Yo!",
      title: "Make it yours",
      note: "Pick a silly picture, switch to dark mode, and send friends your list, with your notes if you want.",
      link: ifSignedIn("/settings", "Open settings"),
    },
  ];

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>
            Take the <span className={about.hit}>tour</span>
          </h1>
          <p className={styles.lead}>
            Six stops, a minute or so. Every link opens the real thing, so try
            whatever looks good.
          </p>
        </div>
        <span className={`printed ${styles.kenji}`} aria-hidden>
          <Mascot mood="happy" />
        </span>
      </header>

      {/* role: Safari stops announcing a list once its bullets are styled away */}
      <ol role="list" className={`${about.does} printed`}>
        {stops.map((stop) => (
          <li key={stop.title} className={about.doesPanel}>
            <div className={`${about.doesArt} ${stop.art}`} aria-hidden>
              {stop.mascot ? (
                <span className={styles.panelKenji}>
                  <Mascot mood="happy" />
                </span>
              ) : (
                <span className={about.doesBig}>
                  {stop.small && <small>{stop.small}</small>}
                  {stop.big}
                </span>
              )}
              <span className={about.doesSfx}>{stop.sfx}</span>
            </div>
            <div className={about.doesCopy}>
              <h2 className={about.doesTitle}>{stop.title}</h2>
              <p>{stop.note}</p>
              <NavLink to={stop.link.to} className={about.doesLink} viewTransition>
                {stop.link.label} →
              </NavLink>
            </div>
          </li>
        ))}
      </ol>

      {isSignedIn === false && (
        <div className={about.cta}>
          <NavLink to="/signup" className="btn btn-primary btn-lg" viewTransition>
            Start your shelf
          </NavLink>
        </div>
      )}
    </article>
  );
}

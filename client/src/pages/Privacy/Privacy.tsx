// The privacy policy: what the site and the Android app keep, what stays on
// the reader's device, who else sees anything, and how to delete it all.
// Kept true to the code: a new service, a new kind of data or a new way of
// sharing comes here when it's built. Drawn like the Acknowledgements page.
import { NavLink } from "react-router";
import { CONTACT_EMAIL } from "../../lib/contact";
import { usePageMeta } from "../../lib/seo";
import { acknowledgementsStyles as styles } from "../Acknowledgements/styles";

// the day this page last changed in what it says
const UPDATED = "November 19, 2026";

type Entry = { name: string; body: string };

// one titled section: a few lines, or a list of who and what
function Section({
  id,
  title,
  lines = [],
  entries = [],
}: {
  id: string;
  title: string;
  lines?: string[];
  entries?: Entry[];
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {lines.map((line) => (
        <p key={line} className={styles.body}>
          {line}
        </p>
      ))}
      {entries.length > 0 && (
        // role: Safari stops announcing a list once its bullets are styled away
        <ul role="list" className={`${styles.items} mt-3`}>
          {entries.map((entry) => (
            <li key={entry.name} className={styles.item}>
              <p className="font-medium text-ink">{entry.name}</p>
              <p className={styles.itemBody}>{entry.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const KEPT: Entry[] = [
  {
    name: "Your account",
    body: "Your username and your password, stored only as a secure hash. A display name and picture if you choose them.",
  },
  {
    name: "Your email, if you add one",
    body: "Used for password reset links, and the weekly email if you switch it on. Never shown to anyone else.",
  },
  {
    name: "Your shelf",
    body: "The series you add, the volumes you own, where you are, ratings, notes, your To buy list, what you paid for books, and your settings.",
  },
  {
    name: "Your shelf's history",
    body: "When you add a series, tick a volume, read on or finish one, with the date. It's what your year in manga is made from, and it's only shown to you.",
  },
  {
    name: "Your reviews",
    body: "Volume reviews you write, and reports you make about other reviews.",
  },
  {
    name: "Alerts on your phone",
    body: "If you switch them on: the address your browser gives for sending alerts to that device. Nothing else about the device.",
  },
  {
    name: "Signing in",
    body: "One cookie keeps you signed in for a week. There are no advertising or analytics cookies.",
  },
];

const ON_DEVICE: Entry[] = [
  {
    name: "A copy of your shelf",
    body: "So it opens without a connection. It's removed when you sign out.",
  },
  {
    name: "Changes made offline",
    body: "Kept until they can be sent, then deleted from the device.",
  },
  {
    name: "Small preferences",
    body: "Things like light or dark mode and which tab you were on.",
  },
  {
    name: "The barcode scanner",
    body: "Reads the camera on your device. The picture never leaves it; only the barcode number is used.",
  },
];

const OTHERS: Entry[] = [
  {
    name: "Railway and Cloudflare",
    body: "Host the site and its database, and pass its traffic. Like any web host, they see your IP address.",
  },
  {
    name: "Resend",
    body: "Sends the site's emails (password resets, confirm links, the weekly email). It sees your email address and the email.",
  },
  {
    name: "Google Fonts",
    body: "Serves the site's lettering, so Google sees a request from your browser.",
  },
  {
    name: "Impact",
    body: "A script from the affiliate network Impact loads on the site, to turn some store links into affiliate links and count them. It may set its own cookies.",
  },
  {
    name: "Stores, when you follow a link",
    body: "Amazon, eBay, Books-A-Million and the others see your visit like any visit, and an affiliate link tells them it came from here. What you do there is under their privacy policy.",
  },
  {
    name: "Cover images",
    body: "Some covers load straight from MangaDex, AniList, Open Library and Google Books, which see the request.",
  },
  {
    name: "Imports",
    body: "Importing from AniList or Kitsu asks them for that account's list. A file you import is read in your browser.",
  },
  {
    name: "Push services",
    body: "Phone alerts are delivered by your browser's own service (Google, Apple or Mozilla). They carry the alert, not your shelf.",
  },
];

export function PrivacyPage() {
  usePageMeta({
    title: "Privacy policy",
    description:
      "What Manga Tracker keeps, what stays on your device, who else sees anything, and how to delete it all.",
    path: "/privacy",
  });

  return (
    <article className={`${styles.page} fade-in`}>
      <header>
        <h1 className={styles.title}>Privacy policy</h1>
        <p className={styles.lead}>
          Your shelf is yours. No ads, nothing sold, and only what the site
          needs to work. This covers the website and the Android app, which
          shows the same site.
        </p>
        <p className={`${styles.body} mt-2`}>Last updated {UPDATED}.</p>
      </header>

      <Section id="pv-kept" title="What's kept" entries={KEPT} />
      <Section
        id="pv-device"
        title="What stays on your device"
        entries={ON_DEVICE}
      />

      <Section
        id="pv-use"
        title="What it's used for"
        lines={[
          "Only to run Manga Tracker: showing your shelf, checking for new volumes and prices, and sending the emails and alerts you ask for.",
          "It's never sold, never used for ads, and never shared with anyone except the services below, for the job each one does.",
        ]}
      />

      <Section id="pv-others" title="Who else sees anything" entries={OTHERS} />

      <Section
        id="pv-shared"
        title="Shared only if you choose"
        entries={[
          {
            name: "Your shared shelf",
            body: "Off until you switch it on in Settings. Anyone with its link sees what you picked to show. Switch it off and the link stops working.",
          },
          {
            name: "Reviews",
            body: "Shown with your display name and picture, never your username.",
          },
          {
            name: "Matches that help everyone",
            body: "When several readers' imports agree that a title is a certain series, the match is used for everyone. It never says whose import it came from.",
          },
        ]}
      />

      <Section
        id="pv-delete"
        title="Deleting your data"
        lines={[
          "Settings, Account, Delete my account removes your account and everything on your shelf for good. Download your list first if you might want it.",
          "Copies in the database's backups are replaced in time.",
          `Can't sign in? Email ${CONTACT_EMAIL} from the address on your account and it'll be deleted for you.`,
        ]}
      />

      <Section
        id="pv-kids"
        title="Children"
        lines={[
          "Manga Tracker isn't meant for children under 13, and doesn't knowingly keep anything about them. If you think a child has an account, email and it'll be removed.",
        ]}
      />

      <section aria-labelledby="pv-contact">
        <h2 id="pv-contact" className={styles.sectionTitle}>
          Questions and changes
        </h2>
        <p className={styles.body}>
          Ask anything at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={styles.itemName}>
            {CONTACT_EMAIL}
          </a>
          . If this policy changes, the date above changes with it, and big
          changes are listed on{" "}
          <NavLink to="/updates" className={styles.itemName} viewTransition>
            What's new
          </NavLink>
          .
        </p>
      </section>
    </article>
  );
}

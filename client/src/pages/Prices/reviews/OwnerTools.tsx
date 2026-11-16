// The owner's tools, at the top of their page: the site's own review pages,
// the outside dashboards the site runs on, and the scripts to run in
// Railway's console (server/scripts, built to dist/scripts). Only shown on
// the owner's page, which only the owner's account can open
import { NavLink } from "react-router";
import { reportedStyles as styles } from "./reportedStyles";

// pages on this site, for the owner's account only
const PAGES = [
  { to: "/reviews/reported", name: "Reported reviews", what: "keep or remove" },
  {
    to: "/after-the-anime/review",
    name: "Readers' fixes",
    what: "After the anime corrections",
  },
];

// the services the site runs on
const DASHBOARDS = [
  {
    href: "https://railway.com/dashboard",
    name: "Railway",
    what: "deploys, logs, console",
  },
  {
    href: "https://search.google.com/search-console",
    name: "Search Console",
    what: "Google indexing",
  },
  {
    href: "https://dash.cloudflare.com/",
    name: "Cloudflare",
    what: "domain and cache",
  },
  {
    href: "https://serpapi.com/dashboard",
    name: "SerpApi",
    what: "searches left",
  },
  {
    href: "https://developer.ebay.com/my/keys",
    name: "eBay developers",
    what: "API keys and limits",
  },
  { href: "https://members.cj.com/", name: "CJ", what: "Books-A-Million" },
  {
    href: "https://app.impact.com/",
    name: "Impact",
    what: "Better World Books",
  },
  {
    href: "https://affiliate-program.amazon.com/home",
    name: "Amazon Associates",
    what: "links and earnings",
  },
];

// run in Railway's console. Those marked apply only look until --apply
const SCRIPTS = [
  {
    file: "mixedEditions",
    what: "series mixing two numberings (read only)",
    apply: false,
  },
  {
    file: "saveEnglishCovers",
    what: "English covers for saved series",
    apply: true,
  },
  {
    file: "retitleNovels",
    what: "light novels saved under the manga's name",
    apply: true,
  },
  {
    file: "recheckSamples",
    what: "re-judge saved prices with today's rules",
    apply: true,
  },
  {
    file: "recheckEbaySets",
    what: "eBay box set and omnibus rows",
    apply: true,
  },
  {
    file: "seedImportMatches",
    what: "fill the import's shared matches",
    apply: true,
  },
];

export default function OwnerTools() {
  return (
    <section aria-labelledby="owner-tools" className={styles.tools}>
      <h2 id="owner-tools" className={styles.toolsTitle}>
        Owner tools
      </h2>
      <div className={styles.toolsGroups}>
        <div>
          <h3 className={styles.toolsHead}>On the site</h3>
          <ul className={styles.toolsList}>
            {PAGES.map((p) => (
              <li key={p.to}>
                <NavLink to={p.to} className={styles.toolLink} viewTransition>
                  {p.name}
                </NavLink>{" "}
                <span className={styles.toolWhat}>{p.what}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={styles.toolsHead}>Dashboards</h3>
          <ul className={styles.toolsList}>
            {DASHBOARDS.map((d) => (
              <li key={d.href}>
                <a
                  href={d.href}
                  className={styles.toolLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.name}
                </a>{" "}
                <span className={styles.toolWhat}>{d.what}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <details className={styles.scripts}>
        <summary className={styles.toolsHead}>
          Scripts, in Railway's console
        </summary>
        <ul className={styles.toolsList}>
          {SCRIPTS.map((s) => (
            <li key={s.file}>
              <code className={styles.command}>
                node dist/scripts/{s.file}.js{s.apply ? " --apply" : ""}
              </code>{" "}
              <span className={styles.toolWhat}>{s.what}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

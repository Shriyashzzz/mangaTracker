import { useEffect, useMemo, useState } from "react";
import { NavLink, useSearchParams } from "react-router";
import { getSeriesIndex, seriesCanonicalPath } from "../../lib/prices";
import { usePageMeta } from "../../lib/seo";
import SeriesCard from "./SeriesCard";
import { pickGenre } from "../../lib/anilist";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import styles from "./Prices.module.css";

// the letter a series files under: "The Apothecary Diaries" under A, and
// anything not starting with a letter under #
const letterOf = (name) => {
  const first = name.replace(/^the\s+/i, "").trim()[0]?.toUpperCase() ?? "#";
  return /[A-Z]/.test(first) ? first : "#";
};
const sortName = (name) => name.replace(/^the\s+/i, "").toLowerCase();

// every series we have prices for, by popularity or A to Z, with a genre
// filter. The choices live in the URL so a filtered list can be shared
export default function SeriesIndex() {
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") === "az" ? "az" : "popular";
  const genre = params.get("genre") ?? "";
  const [state, setState] = useState({ series: null, error: false });

  useEffect(() => {
    const controller = new AbortController();
    getSeriesIndex(controller.signal)
      .then((series) => setState({ series, error: false }))
      .catch((e) => {
        if (e.name !== "AbortError") setState({ series: [], error: true });
      });
    return () => controller.abort();
  }, []);

  const all = state.series;
  const genres = useMemo(
    () => [...new Set((all ?? []).flatMap((s) => s.genres))].sort(),
    [all],
  );
  const shown = useMemo(() => {
    const list = (all ?? []).filter((s) => !genre || s.genres.includes(genre));
    return sort === "az"
      ? list.sort((a, b) => sortName(a.name).localeCompare(sortName(b.name)))
      : list.sort(
          (a, b) =>
            (a.popularityRank ?? Infinity) - (b.popularityRank ?? Infinity) ||
            (b.score ?? 0) - (a.score ?? 0),
        );
  }, [all, sort, genre]);

  usePageMeta({
    title: genre ? `${genre} manga series` : "All manga series",
    description: `Browse ${all?.length || "every"} manga series and compare what US stores charge for each volume${genre ? `, filtered to ${genre}` : ""}.`,
    path: "/series",
    // a filtered list is the same page; only the full list gets indexed
    noindex: Boolean(genre || params.get("sort")),
    jsonLd: all?.length
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Manga series",
          numberOfItems: shown.length,
          itemListElement: shown.slice(0, 200).map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: s.name,
            url: new URL(seriesCanonicalPath(s.name), location.origin).href,
          })),
        }
      : null,
  });

  const setChoice = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // A to Z: grouped under letter headings, with a bar to jump between them
  const groups = useMemo(() => {
    if (sort !== "az") return null;
    const map = new Map();
    for (const s of shown) {
      const l = letterOf(s.name);
      if (!map.has(l)) map.set(l, []);
      map.get(l).push(s);
    }
    return [...map];
  }, [shown, sort]);

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={styles.indexHead}>
        <h1 className={styles.title}>All series</h1>
        <p className={styles.sub}>
          Every series we've priced so far
          {all?.length ? ` (${all.length})` : ""}. Pick one to compare its
          volumes across US stores.
        </p>

        <div className={styles.indexControls}>
          <div className={styles.segmented} role="group" aria-label="Sort">
            {[
              ["popular", "Popular"],
              ["az", "A to Z"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={sort === value}
                onClick={() =>
                  setChoice("sort", value === "popular" ? "" : value)
                }
              >
                {label}
              </button>
            ))}
          </div>
          {genres.length > 0 && (
            <label className={styles.genrePick}>
              <span>Genre</span>
              <select
                value={genre}
                onChange={(e) => setChoice("genre", e.target.value)}
              >
                <option value="">All genres</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      {all === null ? (
        <div className={styles.grid} aria-busy="true" aria-label="Loading">
          <SlowLoadQuote />
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className={`skeleton ${styles.cardSkeleton}`} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className={styles.empty} role={state.error ? "alert" : undefined}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={styles.emptyTitle}>
            {state.error ? "The list didn't load." : "Nothing in that genre yet."}
          </p>
          <p>
            {state.error
              ? "Try again in a moment, or search for a series directly."
              : "Series show up here once someone looks them up."}
          </p>
          <NavLink to="/" className="btn btn-secondary" viewTransition>
            Search for a series
          </NavLink>
        </div>
      ) : groups ? (
        <>
          <nav className={styles.letterBar} aria-label="Jump to letter">
            {groups.map(([letter]) => (
              <a key={letter} href={`#letter-${letter}`}>
                {letter}
              </a>
            ))}
          </nav>
          {groups.map(([letter, list]) => (
            <section
              key={letter}
              id={`letter-${letter}`}
              className={styles.letterGroup}
              aria-labelledby={`letter-${letter}-title`}
            >
              <h2 id={`letter-${letter}-title`} className={styles.sectionTitle}>
                {letter}
              </h2>
              <ul className={styles.grid}>
                {list.map((s) => (
                  <li key={s.name}>
                    <SeriesCard series={{ ...s, genre: pickGenre(s.genres) }} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <ul className={styles.grid}>
          {shown.map((s) => (
            <li key={s.name}>
              <SeriesCard series={{ ...s, genre: pickGenre(s.genres) }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { searchCovers } from "../../lib/anilist";
import styles from "./CoverPicker.module.css";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 450;

// looks the title up on AniList and lets the user pick a cover,
// or paste their own link. `value` is the chosen image URL.
export default function CoverPicker({ title, value, onChange }) {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  // once the user picks or pastes something we stop auto-choosing for them
  const touched = useRef(Boolean(value));

  const query = title.trim();
  const tooShort = query.length < MIN_QUERY;

  useEffect(() => {
    if (tooShort) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const found = await searchCovers(query, controller.signal);
        setResults(found);
        setStatus("done");
        if (!touched.current && found.length) onChange(found[0].cover);
      } catch (e) {
        if (e.name !== "AbortError") setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // onChange is a setter from the parent, it doesn't need to retrigger the search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tooShort]);

  // a cleared title hides old results without another round trip
  const shownStatus = tooShort ? "idle" : status;
  const shown = tooShort ? [] : results;

  const pick = (url) => {
    touched.current = true;
    onChange(url);
  };

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label} id="cover-label">
          Cover <span className={styles.optional}>(optional)</span>
        </span>
        <span className={styles.status} aria-live="polite">
          {shownStatus === "loading" && "Looking it up…"}
          {shownStatus === "done" &&
            (shown.length
              ? `${shown.length} match${shown.length > 1 ? "es" : ""} on AniList`
              : "No covers found for that title")}
          {shownStatus === "error" && "Couldn't reach AniList, paste a link instead"}
          {shownStatus === "idle" && "Type a title and covers show up here"}
        </span>
      </div>

      {shownStatus === "loading" && shown.length === 0 && (
        <div className={styles.strip} aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={`skeleton ${styles.thumbSkeleton}`} />
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <div
          className={`${styles.strip} ${shownStatus === "loading" ? styles.stale : ""}`}
          role="radiogroup"
          aria-labelledby="cover-label"
        >
          {shown.map((r) => {
            const selected = value === r.cover;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${styles.thumb} ${selected ? styles.selected : ""}`}
                onClick={() => pick(selected ? "" : r.cover)}
                title={r.year ? `${r.title} (${r.year})` : r.title}
              >
                <img src={r.cover} alt="" loading="lazy" />
                <span className={styles.thumbTitle}>
                  {r.title}
                  {r.year && <span className={styles.year}> {r.year}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <label className={styles.urlRow}>
        <span>or paste a link</span>
        <input
          type="url"
          name="image"
          placeholder="https://example.com/cover.jpg"
          value={value}
          onChange={(e) => pick(e.target.value)}
        />
      </label>

      {shown.length > 0 && (
        <span className={styles.credit}>
          Covers from{" "}
          <a href="https://anilist.co" target="_blank" rel="noreferrer">
            AniList
          </a>
        </span>
      )}
    </div>
  );
}

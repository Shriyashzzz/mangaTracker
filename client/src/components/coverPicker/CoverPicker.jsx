import { useEffect, useRef, useState } from "react";
import { searchCovers } from "../../lib/anilist";
import styles from "./CoverPicker.module.css";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 450;

// the cover column of the add / edit forms: shows the chosen cover big,
// looks the title up on AniList for alternatives, and takes a pasted link.
// `value` is the chosen image URL, and onChange also gets the AniList
// match (null for a pasted link)
export default function CoverPicker({
  title,
  value,
  onChange,
  className = "",
}) {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [brokenUrl, setBrokenUrl] = useState(null);
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
        if (!touched.current && found.length) {
          onChange(found[0].cover, found[0]);
        }
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
  const broken = Boolean(value) && brokenUrl === value;

  const pick = (url, match = null) => {
    touched.current = true;
    onChange(url, match);
  };

  return (
    <div className={`${styles.picker} ${className}`}>
      <span className={styles.label} id="cover-label">
        Cover <span className={styles.optional}>(optional)</span>
      </span>

      <div
        className={`${styles.cover} ${value && !broken ? styles.hasImage : ""}`}
      >
        {value && !broken ? (
          <img src={value} alt="" onError={() => setBrokenUrl(value)} />
        ) : (
          <span className={styles.coverHint}>
            {broken
              ? "hm, that link isn't loading as an image"
              : "type a title and a cover shows up here"}
          </span>
        )}
      </div>

      <span className={styles.status} aria-live="polite">
        {shownStatus === "loading" && "Looking it up…"}
        {shownStatus === "done" &&
          (shown.length ? (
            <>
              Matches from{" "}
              <a href="https://anilist.co" target="_blank" rel="noreferrer">
                AniList
              </a>
            </>
          ) : (
            "No covers found for that title"
          ))}
        {shownStatus === "error" &&
          "Couldn't reach AniList, paste a link instead"}
      </span>

      {shownStatus === "loading" && shown.length === 0 && (
        <div className={styles.grid} aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={`skeleton ${styles.thumbSkeleton}`} />
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <div
          className={`${styles.grid} ${shownStatus === "loading" ? styles.stale : ""}`}
          role="radiogroup"
          aria-labelledby="cover-label"
        >
          {shown.map((r) => {
            const selected = value === r.cover;
            const label = r.year ? `${r.title} (${r.year})` : r.title;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                className={`${styles.thumb} ${selected ? styles.selected : ""}`}
                onClick={() => (selected ? pick("") : pick(r.cover, r))}
              >
                <img src={r.cover} alt="" loading="lazy" />
              </button>
            );
          })}
        </div>
      )}

      <label className={styles.url}>
        <span className="sr-only">Cover image link</span>
        <input
          type="url"
          name="image"
          placeholder="or paste an image link"
          value={value}
          onChange={(e) => pick(e.target.value)}
        />
      </label>
    </div>
  );
}

// "Suggest a fix" under a season: the last chapter it covers, the volume to
// start from, and where they read it. Kept for review (server: fixStore.ts);
// nothing on the page changes until it's accepted.
import { useId, useState, type FormEvent } from "react";
import { sendFix } from "../../lib/afterAnime";
import { afterAnimeStyles as styles } from "./styles";

// a typed number, or null for an empty box
const numberOrNull = (typed: string) =>
  typed.trim() === "" ? null : Number(typed);

export default function FixForm({
  seriesName,
  // the season it's about; null when the page has no seasons, and they name it
  season,
  open = false,
}: {
  seriesName: string;
  season: string | null;
  open?: boolean;
}) {
  const id = useId();
  const [label, setLabel] = useState(season ?? "Season 1");
  const [chapter, setChapter] = useState("");
  const [volume, setVolume] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"typing" | "sending" | "sent">("typing");
  const [problem, setProblem] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (chapter.trim() === "" && volume.trim() === "") {
      setProblem("Add the last chapter or the volume to buy.");
      return;
    }
    setState("sending");
    const wrong = await sendFix({
      name: seriesName,
      label,
      chapter: numberOrNull(chapter),
      volume: numberOrNull(volume),
      source,
      note,
    }).catch(() => "That didn't send. Check your connection and try again.");
    setProblem(wrong);
    setState(wrong ? "typing" : "sent");
  };

  let sendLabel = season ? "Send the fix" : "Send it";
  if (state === "sending") sendLabel = "Sending…";

  return (
    <details className={styles.fix} open={open}>
      <summary className={styles.fixSummary}>
        {season
          ? "Is this wrong? Suggest a fix"
          : "Know where it leaves off? Tell us"}
      </summary>
      {state === "sent" ? (
        <p className={styles.fixThanks} role="status">
          Thanks. It will show here once it's been checked against your link.
        </p>
      ) : (
        <form className={styles.fixForm} onSubmit={submit} noValidate>
          {!season && (
            <label className={`${styles.fixField} ${styles.fixWide}`}>
              <span className={styles.fixLabel}>Which season or film?</span>
              <input
                className={styles.fixInput}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                required
              />
            </label>
          )}
          <label className={styles.fixField}>
            <span className={styles.fixLabel}>
              Last chapter the anime covers
            </span>
            <input
              className={styles.fixInput}
              inputMode="decimal"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="137"
            />
          </label>
          <label className={styles.fixField}>
            <span className={styles.fixLabel}>Volume to buy next</span>
            <input
              className={styles.fixInput}
              inputMode="numeric"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="16"
            />
          </label>
          <label className={`${styles.fixField} ${styles.fixWide}`}>
            <span className={styles.fixLabel}>Link to your source</span>
            <input
              className={styles.fixInput}
              type="url"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://"
              maxLength={500}
              required
            />
          </label>
          <label className={`${styles.fixField} ${styles.fixWide}`}>
            <span className={styles.fixLabel}>
              Anything to add? <span className={styles.fixHint}>Optional</span>
            </span>
            <input
              className={styles.fixInput}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </label>
          <div className={styles.fixActions}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={state === "sending"}
            >
              {sendLabel}
            </button>
            {problem && (
              <p
                id={`${id}-problem`}
                className={styles.fixProblem}
                role="alert"
              >
                {problem}
              </p>
            )}
          </div>
        </form>
      )}
    </details>
  );
}

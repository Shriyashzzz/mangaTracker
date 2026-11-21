// The box a reader writes their review in: stars, a few optional words, and
// a tick for spoilers. Also how they change one they've written.
import { useState } from "react";
import StarRating from "../../../components/starRating/StarRating";
import {
  MOST_WORDS,
  type Review,
  type ReviewDraft,
  type SaveResult,
} from "../../../lib/reviews";
import { reviewStyles as styles } from "./reviewStyles";

export default function ReviewForm({
  save,
  // the review being changed; null for a new one
  current,
  onSaved,
  onCancel,
  framed = true,
}: {
  // sends it: a book's price page and a series' page each have their own
  // way (lib/reviews.ts saveReview, saveShelfReview)
  save: (draft: ReviewDraft) => Promise<SaveResult>;
  current: Review | null;
  onSaved: () => void;
  onCancel: () => void;
  // its own inked box, on a volume's page; false inside a dialog, which is
  // the box
  framed?: boolean;
}) {
  const [rating, setRating] = useState(current?.rating ?? 0);
  const [text, setText] = useState(current?.text ?? "");
  const [spoiler, setSpoiler] = useState(current?.spoiler ?? false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  const tooLong = text.length > MOST_WORDS;
  const post = async () => {
    if (!rating) return setProblem("Pick a rating first.");
    if (tooLong) return setProblem(`Keep it under ${MOST_WORDS} characters.`);
    setSaving(true);
    setProblem("");
    const result = await save({ rating, text, spoiler });
    setSaving(false);
    if ("problem" in result) setProblem(result.problem);
    else onSaved();
  };

  return (
    <form
      className={framed ? styles.form : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        post();
      }}
    >
      <span className={styles.label}>Your rating</span>
      {/* a second tap on the same star would clear it: a review needs one */}
      <StarRating
        value={rating}
        size="lg"
        onChange={(stars) => setRating(stars || rating)}
      />
      <label className={`${styles.label} mt-3`} htmlFor="review-words">
        A few words (optional)
      </label>
      <textarea
        id="review-words"
        className={styles.words}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What should someone know before buying it?"
        aria-describedby="review-count"
      />
      <div className={styles.under}>
        <label className={styles.tick}>
          <input
            type="checkbox"
            // an on/off setting: Android's switch in the app (index.css)
            className="app-switch"
            checked={spoiler}
            onChange={(e) => setSpoiler(e.target.checked)}
          />
          Contains spoilers
        </label>
        <span
          id="review-count"
          className={tooLong ? styles.countOver : styles.count}
        >
          {text.length} / {MOST_WORDS}
        </span>
      </div>
      <div className={styles.under}>
        <div className={styles.buttons}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {current ? "Save changes" : "Post review"}
          </button>
          <button type="button" className={styles.link} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
      <p className={styles.problem} role="alert">
        {problem}
      </p>
    </form>
  );
}

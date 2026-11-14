// /reviews/reported  The site owner's list of reviews readers have
// reported: keep one (its reports are cleared and it shows again) or remove
// it for good. The hidden ones come first: those are waiting on a decision.
// The server only answers the owner's account (ADMIN_USERNAME); anyone else
// sees the not-found page.
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import StarRating from "../../../components/starRating/StarRating";
import { timeAgo } from "../../../lib/prices";
import {
  decideReview,
  getReportedReviews,
  type ReportedReview,
} from "../../../lib/reviews";
import { usePrivatePage } from "../../../lib/seo";
import ErrorPage from "../../Error/Error";
import { pricesStyles } from "../styles";
import { writtenText } from "./reviewText";
import { reportedStyles as styles } from "./reportedStyles";

export default function ReportedReviews() {
  usePrivatePage("Reported reviews");
  const [reviews, setReviews] = useState<ReportedReview[] | null>(null);
  const [refused, setRefused] = useState(false);
  // the one being saved, and one that didn't save
  const [saving, setSaving] = useState<number | null>(null);
  const [failed, setFailed] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getReportedReviews(controller.signal)
      .then(setReviews)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setRefused(true);
      });
    return () => controller.abort();
  }, []);

  const decide = async (review: ReportedReview, keep: boolean) => {
    setSaving(review.id);
    setFailed(null);
    const saved = await decideReview(review.id, keep);
    setSaving(null);
    if (!saved) return setFailed(review.id);
    // either way it's no longer one to decide
    setReviews((before) => before?.filter((one) => one.id !== review.id) ?? []);
  };

  if (refused) return <ErrorPage />;
  if (!reviews) return <div className="skeleton h-56" aria-busy="true" />;

  return (
    <div className={`${styles.page} fade-in`}>
      <header>
        <h1 className={pricesStyles.sectionTitle}>Reported reviews</h1>
        <p className={styles.sub}>
          {reviews.length
            ? `${reviews.length} to look at. `
            : "Nothing reported. All caught up. "}
          Keep clears a review's reports. Remove deletes it for good.
        </p>
      </header>
      <ul className={styles.list}>
        {reviews.map((review) => (
          <li key={review.id} className={styles.item}>
            <p className={styles.meta}>
              <span className={review.hidden ? styles.chipHot : styles.chip}>
                {review.hidden && "Hidden · "}
                {review.reports} report{review.reports === 1 ? "" : "s"}
              </span>
              {review.title && <b>{review.title}</b>}
              <span>by {review.by}</span>
              <span className={styles.when}>
                {writtenText(review.writtenAt, timeAgo)}
              </span>
              <StarRating value={review.rating} size="sm" />
            </p>
            <p className={styles.text}>
              {review.text || "(a rating, with no words)"}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className="btn"
                disabled={saving === review.id}
                onClick={() => decide(review, true)}
              >
                Keep
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving === review.id}
                onClick={() => decide(review, false)}
              >
                Remove
              </button>
              <NavLink
                to={`/prices/${review.isbn13}#reviews-title`}
                className={styles.link}
                viewTransition
              >
                Open the volume
              </NavLink>
            </div>
            {failed === review.id && (
              <p className={styles.problem} role="alert">
                That didn't save. Try again.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

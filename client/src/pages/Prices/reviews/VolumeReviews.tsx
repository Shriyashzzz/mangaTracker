// "What readers say", under a volume's prices: the score, readers' reviews,
// and the way to write one. Anyone can read them. Writing needs a sign-in
// and the volume marked owned or read; the server decides, and says which
// (`mayWrite`). The parts:
//   ReviewScore  the average and how ratings spread
//   ReviewItem   one review, its spoiler bar and its flags
//   ReviewForm   writing or changing your own
//   reviewText   the words, on their own
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import StarRating from "../../../components/starRating/StarRating";
import { signInPath } from "../../../lib/api";
import { timeAgo } from "../../../lib/prices";
import { deleteReview, type VolumeReviews as Data } from "../../../lib/reviews";
import { pricesStyles } from "../styles";
import ReviewForm from "./ReviewForm";
import ReviewItem from "./ReviewItem";
import ReviewScore from "./ReviewScore";
import { writtenText } from "./reviewText";
import { reviewStyles as styles } from "./reviewStyles";

// how many reviews show before "Show more"
const FIRST = 5;
// the section's heading, and the #link other pages use to land on it
const TITLE_ID = "reviews-title";

export default function VolumeReviews({
  isbn13,
  // "vol. 8", or "this book" for one holding several
  volumeLabel,
  data,
  reload,
}: {
  isbn13: string;
  volumeLabel: string;
  data: Data;
  // asks the server again: after a change, or to see if they've since
  // marked the volume as read
  reload: () => Promise<void>;
}) {
  const { pathname, hash } = useLocation();
  // a link straight to the reviews ("Add a few words" on a series' page,
  // the owner's list): the section is scrolled to once it's drawn, since it
  // arrives after the page, and their own review opens ready to add to
  const cameForReviews = hash === `#${TITLE_ID}`;
  const [writing, setWriting] = useState(
    cameForReviews && data.yours !== null && data.yours.text === "",
  );
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (cameForReviews) section.current?.scrollIntoView({ block: "start" });
  }, [cameForReviews]);
  const [showAll, setShowAll] = useState(false);
  // they asked to write and can't yet: says why, in place of the form
  const [turnedAway, setTurnedAway] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const { yours, mayWrite } = data;
  const hasRead = mayWrite === "yes";
  // their own is on top, in its own box
  const others = data.reviews.filter((review) => !review.yours);
  const shown = showAll ? others : others.slice(0, FIRST);

  const startWriting = async () => {
    // they may have marked it owned or read since the page opened
    if (mayWrite === "not-read") await reload();
    setWriting(true);
    setTurnedAway(true);
  };
  const afterSaving = async () => {
    await reload();
    setWriting(false);
  };
  const remove = async () => {
    setDeleteFailed(false);
    if (await deleteReview(isbn13)) await reload();
    else setDeleteFailed(true);
  };

  const canOpenForm = writing && hasRead;
  return (
    <section
      ref={section}
      className={styles.section}
      aria-labelledby={TITLE_ID}
    >
      <div className={styles.head}>
        <h2 id={TITLE_ID} className={pricesStyles.sectionTitle}>
          What readers say
        </h2>
        {data.count > 0 && !yours && !writing && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={startWriting}
          >
            Write a review
          </button>
        )}
      </div>

      {canOpenForm && (
        <ReviewForm
          isbn13={isbn13}
          current={yours}
          onSaved={afterSaving}
          onCancel={() => setWriting(false)}
        />
      )}
      {writing && turnedAway && mayWrite === "sign-in" && (
        <p className={styles.nudge}>
          <span>
            <b>Read it?</b> Sign in to leave a review.
          </span>
          <NavLink to={signInPath(pathname)} className="btn" viewTransition>
            Sign in
          </NavLink>
        </p>
      )}
      {writing && turnedAway && mayWrite === "not-read" && (
        <p className={styles.nudge}>
          <span>
            <b>Read it?</b> Mark {volumeLabel} as owned or read on your shelf
            first. Then you can review it.
          </span>
        </p>
      )}

      {yours && !writing && (
        <div className={styles.yours}>
          <div className={styles.itemTop}>
            <span className={styles.who}>
              <b>Your review</b>
              <StarRating value={yours.rating} size="sm" />
              {yours.hidden && (
                <span className={styles.chip}>Hidden for now</span>
              )}
            </span>
            <span className={styles.when}>
              {writtenText(yours.writtenAt, timeAgo)}
            </span>
          </div>
          {yours.text && <p className={styles.text}>{yours.text}</p>}
          {yours.hidden && (
            <p className={styles.emptyNote}>
              Readers reported it. It's hidden until we've had a look.
            </p>
          )}
          <div className={styles.acts}>
            <button
              type="button"
              className={styles.link}
              onClick={() => setWriting(true)}
            >
              Edit
            </button>
            <button type="button" className={styles.link} onClick={remove}>
              Delete
            </button>
            {deleteFailed && (
              <span className={styles.said} role="status">
                That didn't delete. Try again.
              </span>
            )}
          </div>
        </div>
      )}

      {data.count === 0 || data.average === null ? (
        !writing && (
          <div className={styles.empty}>
            <p>
              <b>No reviews yet.</b>
            </p>
            <p className={styles.emptyNote}>
              Reviews come from readers who own or have read this volume.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startWriting}
            >
              Be the first
            </button>
          </div>
        )
      ) : (
        <div className={styles.box}>
          <ReviewScore
            average={data.average}
            count={data.count}
            spread={data.spread}
          />
          <div className={styles.list}>
            {others.length === 0 ? (
              <p className={`${styles.said} py-4`}>
                Rated, with no written reviews yet.
              </p>
            ) : (
              <ul>
                {shown.map((review) => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                    hasRead={hasRead}
                    mayFlag={mayWrite !== "sign-in"}
                  />
                ))}
              </ul>
            )}
            {others.length > shown.length && (
              <button
                type="button"
                className={styles.more}
                onClick={() => setShowAll(true)}
              >
                Show {others.length - shown.length} more
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

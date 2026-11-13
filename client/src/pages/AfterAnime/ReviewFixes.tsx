// /after-the-anime/review  The site owner's list of readers' fixes: read
// each one's link, then accept it (it replaces what the page says for that
// season) or reject it. The server only answers the owner's account
// (ADMIN_USERNAME); anyone else sees the not-found page.
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  afterAnimeCanonicalPath,
  decideFix,
  getFixesToReview,
  type ReaderFix,
} from "../../lib/afterAnime";
import { timeAgo } from "../../lib/prices";
import { usePrivatePage } from "../../lib/seo";
import ErrorPage from "../Error/Error";
import { pricesStyles as priceStyles } from "../Prices/styles";
import { afterAnimeStyles as styles } from "./styles";

// "Season 2: last chapter 139, start from volume 16"
function FixFacts({ fix }: { fix: ReaderFix }) {
  return (
    <p className={styles.reviewFacts}>
      <b>{fix.label}</b>
      {fix.chapter !== null && <>: last chapter {fix.chapter}</>}
      {fix.volume !== null && <>, start from volume {fix.volume}</>}
    </p>
  );
}

export default function ReviewFixes() {
  usePrivatePage("Review fixes");
  const [lists, setLists] = useState<{
    waiting: ReaderFix[];
    decided: ReaderFix[];
  } | null>(null);
  const [refused, setRefused] = useState(false);
  // the fix being saved, and one that didn't save
  const [saving, setSaving] = useState<number | null>(null);
  const [failed, setFailed] = useState<number | null>(null);

  const load = (signal?: AbortSignal) =>
    getFixesToReview(signal)
      .then(setLists)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setRefused(true);
      });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, []);

  const decide = async (fix: ReaderFix, accept: boolean) => {
    setSaving(fix.id);
    setFailed(null);
    const saved = await decideFix(fix.id, accept).catch(() => false);
    setSaving(null);
    if (saved) await load();
    else setFailed(fix.id);
  };

  if (refused) return <ErrorPage />;
  if (!lists) return <div className="skeleton h-56" aria-busy="true" />;

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <h1 className={styles.title}>Readers' fixes</h1>
        <p className={styles.sub}>
          Open the link, check it says what the fix says, then decide. An
          accepted fix replaces the page's answer for that season.
        </p>
      </header>

      <section aria-labelledby="waiting-title">
        <h2 id="waiting-title" className={priceStyles.sectionTitle}>
          Waiting ({lists.waiting.length})
        </h2>
        {lists.waiting.length === 0 && (
          <p className={styles.sub}>Nothing to read. All caught up.</p>
        )}
        <ul className={styles.reviewList}>
          {lists.waiting.map((fix) => (
            <li key={fix.id} className={styles.reviewItem}>
              <NavLink
                to={afterAnimeCanonicalPath(fix.name)}
                className={styles.reviewName}
                viewTransition
              >
                {fix.name}
              </NavLink>
              <FixFacts fix={fix} />
              <a
                href={fix.source}
                target="_blank"
                rel="noreferrer nofollow"
                className={styles.reviewSource}
              >
                {fix.source}
              </a>
              {fix.note && <p className={styles.reviewFacts}>“{fix.note}”</p>}
              <div className={styles.reviewActions}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving === fix.id}
                  onClick={() => decide(fix, true)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={saving === fix.id}
                  onClick={() => decide(fix, false)}
                >
                  Reject
                </button>
                <span className={styles.reviewDecided}>
                  Sent {timeAgo(fix.createdAt)}
                </span>
                {failed === fix.id && (
                  <span className={styles.fixProblem} role="alert">
                    That didn't save. Try again.
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {lists.decided.length > 0 && (
        <section aria-labelledby="decided-title">
          <h2 id="decided-title" className={priceStyles.sectionTitle}>
            Decided lately
          </h2>
          <ul className={styles.reviewList}>
            {lists.decided.map((fix) => (
              <li key={fix.id} className={styles.reviewItem}>
                <span className={styles.reviewName}>{fix.name}</span>
                <FixFacts fix={fix} />
                <div className={styles.reviewActions}>
                  <span className={styles.reviewDecided}>
                    {fix.status === "accepted" ? "Accepted" : "Rejected"}
                    {fix.decidedAt && ` ${timeAgo(fix.decidedAt)}`}
                  </span>
                  {/* a change of mind: the other answer */}
                  <button
                    type="button"
                    className={priceStyles.textBtn}
                    disabled={saving === fix.id}
                    onClick={() => decide(fix, fix.status !== "accepted")}
                  >
                    {fix.status === "accepted"
                      ? "Reject instead"
                      : "Accept instead"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

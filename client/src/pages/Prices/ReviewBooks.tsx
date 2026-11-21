// /editions/review  The site owner's list of books readers reported missing
// from an edition: each with the volumes readers said it holds and how many
// said it. Approve shows it everywhere at once; reject keeps it out however
// many readers report it. The server only answers the owner's account
// (ADMIN_USERNAME); anyone else sees the not-found page.
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  decideReportedBook,
  getReportedBooks,
  type ReportedBook,
} from "../../lib/editionsIndex";
import { rangesText } from "../../lib/ownedVolumes";
import { timeAgo } from "../../lib/prices";
import { usePrivatePage } from "../../lib/seo";
import ErrorPage from "../Error/Error";
import { afterAnimeStyles as styles } from "../AfterAnime/styles";
import { pricesStyles as priceStyles } from "./styles";

const STATUS_WORDS: Record<ReportedBook["status"], string> = {
  waiting: "Waiting",
  agreed: "Shown: three readers agree",
  approved: "Approved",
  rejected: "Rejected",
};

export default function ReviewBooks() {
  usePrivatePage("Review books");
  const [books, setBooks] = useState<ReportedBook[] | null>(null);
  const [refused, setRefused] = useState(false);
  // the book being saved, and one that didn't save
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = (signal?: AbortSignal) =>
    getReportedBooks(signal)
      .then(setBooks)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setRefused(true);
      });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, []);

  const keyOf = (b: ReportedBook) => `${b.series}|${b.edition}|${b.number}`;
  const decide = async (
    book: ReportedBook,
    volumes: number[],
    approve: boolean,
  ) => {
    setSaving(keyOf(book));
    setFailed(null);
    const saved = await decideReportedBook(book, volumes, approve).catch(
      () => false,
    );
    setSaving(null);
    if (saved) await load();
    else setFailed(keyOf(book));
  };

  if (refused) return <ErrorPage />;
  if (!books) return <div className="skeleton h-56" aria-busy="true" />;

  const open = books.filter((b) => b.status === "waiting");
  const done = books.filter((b) => b.status !== "waiting");

  const item = (book: ReportedBook) => (
    <li key={keyOf(book)} className={styles.reviewItem}>
      <NavLink
        to={`/editions?${new URLSearchParams({ series: book.name })}`}
        className={styles.reviewName}
        viewTransition
      >
        {book.name}
      </NavLink>
      <p className={styles.reviewFacts}>
        <b>
          {book.edition} {book.number}
        </b>
        {book.status !== "waiting" && <> · {STATUS_WORDS[book.status]}</>}
      </p>
      <ul className="flex flex-col gap-2">
        {book.said.map((said) => (
          <li key={said.volumes.join(",")} className={styles.reviewActions}>
            <span className={styles.reviewFacts}>
              vols. {rangesText(said.volumes)} ·{" "}
              {said.readers === 1 ? "1 reader" : `${said.readers} readers`}
            </span>
            {book.status !== "approved" && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving === keyOf(book)}
                onClick={() => decide(book, said.volumes, true)}
              >
                Approve
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.reviewActions}>
        {book.status !== "rejected" && (
          <button
            type="button"
            className="btn"
            disabled={saving === keyOf(book)}
            onClick={() => decide(book, book.said[0]?.volumes ?? [], false)}
          >
            Reject
          </button>
        )}
        <span className={styles.reviewDecided}>
          Last report {timeAgo(book.lastAt)}
        </span>
        {failed === keyOf(book) && (
          <span className={styles.fixProblem} role="alert">
            That didn't save. Try again.
          </span>
        )}
      </div>
    </li>
  );

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <h1 className={styles.title}>Reported books</h1>
        <p className={styles.sub}>
          Check the book exists, then approve the volumes it really holds. It
          shows on the editions and series pages at once.
        </p>
      </header>

      <section aria-labelledby="waiting-title">
        <h2 id="waiting-title" className={priceStyles.sectionTitle}>
          Waiting ({open.length})
        </h2>
        {open.length === 0 && (
          <p className={styles.sub}>Nothing to check. All caught up.</p>
        )}
        <ul className={styles.reviewList}>{open.map(item)}</ul>
      </section>

      {done.length > 0 && (
        <section aria-labelledby="decided-title">
          <h2 id="decided-title" className={priceStyles.sectionTitle}>
            Shown or decided
          </h2>
          <ul className={styles.reviewList}>{done.map(item)}</ul>
        </section>
      )}
    </div>
  );
}

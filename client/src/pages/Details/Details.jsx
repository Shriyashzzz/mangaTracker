import { useEffect, useState } from "react";
import styles from "./Details.module.css";
import { NavLink, useNavigate, useParams } from "react-router";
import StarRating from "../../components/starRating/StarRating";
import { apiFetch, FALLBACK_COVER } from "../../lib/api";

export default function Details() {
  const [mangaData, setMangaData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const { id } = useParams();
  const [mangaStatus, setMangaStatus] = useState(false);
  const [mangaRating, setMangaRating] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function getManga() {
      try {
        const response = await apiFetch(`/details/${id}`);
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        const thisManga = data.detail;
        if (!thisManga) throw new Error("Not found");
        setMangaData(thisManga);
        setMangaRating(parseInt(thisManga.rating) || 0);
        setMangaStatus(thisManga.status);
      } catch {
        setLoadError(true);
      }
    }
    getManga();
  }, [id]);

  const handleDeleteManga = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`/details/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed deleting manga`);
      navigate("/", { viewTransition: true });
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  };

  const handleStatusChange = async () => {
    const next = !mangaStatus;
    // optimistic, roll back if the server says no
    setMangaStatus(next);
    try {
      const res = await apiFetch(`/details/${id}/status`, {
        method: "PATCH",
        body: { status: next },
      });
      if (!res.ok) throw new Error(`Failed changing manga status`);
    } catch (e) {
      console.error(e);
      setMangaStatus(!next);
    }
  };

  const handleRatingChange = async (newRating) => {
    const previous = mangaRating;
    setMangaRating(newRating);
    try {
      const response = await apiFetch(`/details/${id}/rating`, {
        method: "PATCH",
        body: { newRating },
      });
      if (!response.ok) throw new Error(response.statusText);
    } catch (e) {
      console.error(`failed changing manga rating, ${e.message}`);
      setMangaRating(previous);
    }
  };

  if (loadError) {
    return (
      <div className={styles.errorState}>
        <h1>Couldn't open this one.</h1>
        <p>It might have been deleted, or you might need to sign in first.</p>
        <div className={styles.errorActions}>
          <NavLink to="/signin" className="btn btn-primary" viewTransition>
            Sign in
          </NavLink>
          <NavLink to="/" className="btn btn-ghost" viewTransition>
            Back to the shelf
          </NavLink>
        </div>
      </div>
    );
  }

  if (!mangaData) return <DetailsSkeleton />;

  const cover = mangaData.image || FALLBACK_COVER;
  const genre =
    mangaData.genre && mangaData.genre !== "unlabled" ? mangaData.genre : null;

  return (
    <div className="fade-in">
      <NavLink to="/" className={styles.backLink} viewTransition>
        ← back to the shelf
      </NavLink>

      <article className={styles.layout}>
        <figure className={styles.cover}>
          <img
            src={cover}
            alt={mangaData.name}
            onError={(e) => {
              // a dead cover link falls back to the default cover once
              if (e.currentTarget.src !== FALLBACK_COVER) {
                e.currentTarget.src = FALLBACK_COVER;
              }
            }}
          />
          {mangaStatus && <span className={styles.stamp}>Done</span>}
        </figure>

        <header className={styles.head}>
          <h1 className={styles.title}>{mangaData.name}</h1>
          <ul className={styles.meta}>
            <li className={mangaStatus ? styles.metaDone : styles.metaReading}>
              {mangaStatus ? "Finished" : "Reading"}
            </li>
            {genre && <li>{genre}</li>}
          </ul>
          <p className={styles.progress}>
            {mangaStatus ? (
              <>Read all the way through.</>
            ) : (
              <>
                You're on <span>chapter {mangaData.bookmark}</span>
              </>
            )}
          </p>
        </header>

        <div className={styles.body}>
          <div className={styles.rating}>
            <span className={styles.label}>
              {mangaRating ? "Your rating" : "Rate it"}
            </span>
            <StarRating
              value={mangaRating}
              size="lg"
              onChange={handleRatingChange}
            />
          </div>

          {mangaData.description && (
            <div className={styles.notes}>
              <span className={styles.label}>Your notes</span>
              <p>{mangaData.description}</p>
            </div>
          )}

          <div className={styles.actions}>
            <button
              className="btn btn-primary"
              onClick={() =>
                navigate(`/update/${mangaData.id}`, { viewTransition: true })
              }
            >
              Edit
            </button>
            <button className="btn btn-secondary" onClick={handleStatusChange}>
              {mangaStatus ? "Mark as reading" : "Mark as finished"}
            </button>
            <NavLink
              to={`/prices?${new URLSearchParams({ q: mangaData.name })}`}
              className="btn btn-ghost"
              viewTransition
            >
              Check prices
            </NavLink>

            {confirmDelete ? (
              <span className={styles.confirm} role="alert">
                Really delete it?
                <button
                  className={styles.confirmYes}
                  onClick={handleDeleteManga}
                  disabled={busy}
                >
                  {busy ? "deleting…" : "yes, delete"}
                </button>
                <button
                  className={styles.confirmNo}
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  keep it
                </button>
              </span>
            ) : (
              <button
                className={`btn btn-ghost ${styles.deleteBtn}`}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true" aria-label="Loading">
      <div className={`skeleton ${styles.cover} ${styles.skeletonCover}`} />
      <div className={styles.head}>
        <div className="skeleton" style={{ width: "60%", height: 44 }} />
        <div className="skeleton" style={{ width: 160, height: 24 }} />
        <div className="skeleton" style={{ width: "40%", height: 28 }} />
      </div>
      <div className={styles.body}>
        <div className="skeleton" style={{ width: "100%", height: 110 }} />
      </div>
    </div>
  );
}

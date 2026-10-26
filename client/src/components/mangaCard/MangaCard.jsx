import { NavLink } from "react-router";
import styles from "./MangaCard.module.css";
import StarRating from "../starRating/StarRating";
import { FALLBACK_COVER } from "../../lib/api";

export default function MangaCard({ currentManga, index = 0 }) {
  const genre =
    currentManga.genre && currentManga.genre !== "unlabled"
      ? currentManga.genre
      : null;

  return (
    <NavLink
      to={`/details/${currentManga.id}`}
      className={styles.card}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      viewTransition
    >
      <div className={styles.cover}>
        <img
          src={currentManga.image || FALLBACK_COVER}
          alt=""
          loading="lazy"
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_COVER) {
              e.currentTarget.src = FALLBACK_COVER;
            }
          }}
        />
        {currentManga.status && <span className={styles.stamp}>Done</span>}
      </div>
      <div className={styles.meta}>
        <p className={styles.mangaTitlePara}>{currentManga.name}</p>
        <p className={styles.chapter}>
          {currentManga.status ? "finished" : `ch. ${currentManga.bookmark}`}
          {genre && <span> · {genre}</span>}
        </p>
        {Number(currentManga.rating) > 0 && (
          <StarRating value={Number(currentManga.rating)} size="sm" />
        )}
      </div>
    </NavLink>
  );
}

export function MangaCardSkeleton() {
  return (
    <div className={styles.skeletonCard} aria-hidden>
      <div className={`skeleton ${styles.skeletonCover}`} />
      <div className={`skeleton ${styles.skeletonLine}`} />
      <div className={`skeleton ${styles.skeletonLineShort}`} />
    </div>
  );
}

import { NavLink } from "react-router";
import styles from "./MangaCard.module.css";

export default function MangaCard({ currentManga }) {
  return (
    <NavLink to={`/details/${currentManga.id}`} key={currentManga.id}>
      <div className={styles.card}>
        {currentManga.status ? (
          <p>Finished</p>
        ) : (
          <p>Bookmark: Ch {currentManga.bookmark}</p>
        )}

        <img
          src={
            currentManga.image ||
            "https://images.penguinrandomhouse.com/cover/9781569319003"
          }
          alt=""
        />
        {currentManga.name}
      </div>
    </NavLink>
  );
}

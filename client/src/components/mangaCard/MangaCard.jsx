import { NavLink } from "react-router";
import styles from "./MangaCard.module.css";

export default function MangaCard({ currentManga }) {
  return (
    <NavLink to={`/details/${currentManga.id}`}>
      <div className={styles.card}>
        <p>Bookmark: {currentManga.bookmark}</p>
        <img src={currentManga.image} alt="" />
        {currentManga.name}
      </div>
    </NavLink>
  );
}

import { useEffect } from "react";
import styles from "./Details.module.css";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import Rating from "@mui/material/Rating";
import Button from "@mui/material/Button";

export default function Details() {
  const [mangaData, setMangaData] = useState({});
  const { id } = useParams();
  const [mangaStatus, setMangaStatus] = useState(null);
  const [mangaRating, setMangaRating] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    async function getManga() {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/details/${id}`,
        { credentials: "include" },
      );
      const data = await response.json();
      const thisManga = data.detail;
      setMangaData(thisManga);
      setMangaRating(parseInt(thisManga.rating));
      setMangaStatus(thisManga.status);
    }
    getManga();
  }, []);

  const handleDeleteManga = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/details/${id}`, {
        credentials: "include",
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Failed Changing manga status`);
      navigate("/home", { viewTransition: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusChnage = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/details/${id}/status`,
        {
          method: `PATCH`,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: !mangaStatus }),
        },
      );
      if (!res.ok) throw new Error(`Failed Changing manga status`);
      setMangaStatus(!mangaStatus);
    } catch (e) {
      console.log(e);
    }
  };

  const handleDetailsUpdate = () => {
    navigate(`/update/${mangaData.id}`, { viewTransition: true });
  };

  const handleRatingChange = async (e) => {
    console.log(`current rating:`, e.target.value);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/details/${id}/rating`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newRating: e.target.value }),
        },
      );
      if (response.ok) {
        console.log("successfully changed rating");
        setMangaRating(e.target.value);
      }
    } catch (e) {
      console.log(`failed changing manga rating, ${e.message}`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.containerBox}>
        <div className={styles.titleBookmark}>
          <h1>{mangaData.name}</h1>
        </div>

        <section className={styles.previewDesc}>
          <div className={styles.mangaPreview}>
            <img
              src={
                mangaData.image ||
                "https://images.penguinrandomhouse.com/cover/9781569319003"
              }
              alt={mangaData.name}
            />
            <div className={styles.mangaStatus}>
              Manga Status:{" "}
              <button onClick={handleStatusChnage}>
                {mangaStatus ? "Finished" : "Not Finished"}
              </button>
            </div>
          </div>

          <div className={styles.mangaDetailContainer}>
            {mangaStatus ? (
              <h2>Finished</h2>
            ) : (
              <h2>Bookmark: Chapter {mangaData.bookmark}</h2>
            )}
            <Rating
              value={mangaRating}
              size="large"
              name="rating"
              onChange={(e) => handleRatingChange(e)}
            />
            {mangaData.genre && (
              <div className={styles.mangaGenre}>
                <p>
                  <b>Genre:</b> {mangaData.genre}
                </p>
              </div>
            )}
            <p>{mangaData.description}</p>
            <div className={styles.updateContainer}>
              <Button variant="contained" onClick={handleDeleteManga}>
                Delete
              </Button>
              <Button variant="contained" onClick={handleDetailsUpdate}>
                Update
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

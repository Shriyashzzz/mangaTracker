import { useEffect } from "react";
import styles from "./Details.module.css";
import { useState } from "react";
import { useParams } from "react-router";
export default function () {
  const [mangaData, setMangaData] = useState({});
  const { id } = useParams();

  useEffect(() => {
    async function getManga() {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/details/${id}`,
      );
      const data = await response.json();
      const thisManga = data.detail;
      console.log(thisManga);
      setMangaData(thisManga);
    }
    getManga();
  }, []);

  return (
    <>
      <div className={styles.contianer}>
        <div className={styles.contianerBox}>
          <div className={styles.mangaPreview}>
            <div className={styles.mangaPreview}>
              <h1>{mangaData.name}</h1>
              <img src={mangaData.image} />
              <div className={styles.mangaStatus}>
                Manga Status:{" "}
                <button>
                  {" "}
                  {mangaData.status ? "Finished" : "Not Finished"}
                </button>
              </div>
            </div>
          </div>
          <div className={styles.mangaDetailContainer}>
            <h2>Bookmark: Chapter {mangaData.bookmark}</h2>
            <p>{mangaData.description}</p>
            <div className={styles.updateContainer}>
              <button>Delete</button>
              <button>Update</button>
              <button>Rate</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

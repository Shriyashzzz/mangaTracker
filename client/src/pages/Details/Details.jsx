import { useEffect } from "react";
import styles from "./Details.module.css";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
export default function () {
  const [mangaData, setMangaData] = useState({});
  const { id } = useParams();
  const [mangaStatus, setMangaStatus] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    async function getManga() {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/details/${id}`,
      );
      const data = await response.json();
      const thisManga = data.detail;
      setMangaData(thisManga);
      setMangaStatus(thisManga.status);
    }
    getManga();
  }, []);

  const handleDeleteManga = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/details/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Failed Changing manga status`);
      navigate("/");
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
    navigate(`/update/${mangaData.id}`);
  };

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
                <button onClick={() => handleStatusChnage()}>
                  {" "}
                  {mangaStatus ? "Finished" : "Not Finished"}
                </button>
              </div>
            </div>
          </div>
          <div className={styles.mangaDetailContainer}>
            {mangaStatus ? (
              <h2>Finished</h2>
            ) : (
              <h2>Bookmark: Chapter {mangaData.bookmark}</h2>
            )}

            <p>{mangaData.description}</p>
            <div className={styles.updateContainer}>
              <button onClick={handleDeleteManga}>Delete</button>
              <button onClick={handleDetailsUpdate}>Update</button>
              <button>Rate</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

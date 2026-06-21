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
        <div>{mangaData.name}</div>
        <img src={mangaData.image} />
        {mangaData.status ? (
          <p>Finished</p>
        ) : (
          <p>Bookmark: {mangaData.bookmark}</p>
        )}
      </div>
    </>
  );
}

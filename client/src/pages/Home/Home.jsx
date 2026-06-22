import { useState, useEffect } from "react";
import MangaCard from "../../components/mangaCard/mangaCard";
import styles from "./Home.module.css";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router";

export default function Home() {
  const [mangaData, setMangaData] = useState([]);
  const navigator = useNavigate();
  useEffect(() => {
    async function fetchMangaData() {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/mangadata`,
      );
      const mangaObj = await response.json();
      const mangaArray = mangaObj.mangaData;
      setMangaData(mangaArray);
    }
    fetchMangaData();
  }, []);

  return (
    <>
      <Button
        sx={{
          marginTop: `5rem`,
        }}
        variant="contained"
        onClick={() => navigator("/add")}
      >
        Add Manga +
      </Button>
      <div className={styles.classContainer}>
        {mangaData.map((currentManga) => {
          return (
            <MangaCard key={currentManga.id} currentManga={currentManga} />
          );
        })}
      </div>
    </>
  );
}

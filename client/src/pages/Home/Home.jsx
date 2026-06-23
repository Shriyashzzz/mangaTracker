import { useState, useEffect } from "react";
import MangaCard from "../../components/mangaCard/mangaCard";
import styles from "./Home.module.css";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router";
import Select from "@mui/material/Select";
import NativeSelect from "@mui/material/NativeSelect";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
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
  const filterChangeHandler = (e) => {
    const filterValue = e.target.value;
  };

  return (
    <>
      <div className={styles.homeBtn}>
        <FormControl size="small">
          <InputLabel variant="standard">Filter</InputLabel>
          <NativeSelect onChange={(e) => filterChangeHandler(e)}>
            <option value="" aria-label="None"></option>
            <option value={"rating-dsc"}>Rating (High to Low)</option>
            <option value={"rating-asc"}>Rating (Low to High)</option>
            <option value={"ch-dsc"}>Chapters (High to Low)</option>
            <option value={"ch-asc"}>Chapters (Low to High)</option>
          </NativeSelect>
        </FormControl>
        <Button
          sx={{ minWidth: 120 }}
          variant="contained"
          onClick={() => navigator("/add")}
        >
          Add Manga
        </Button>
      </div>
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

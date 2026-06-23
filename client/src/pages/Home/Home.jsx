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

  return (
    <>
      <div className={styles.homeBtn}>
        <FormControl size="small">
          <InputLabel variant="standard">Filter</InputLabel>
          <NativeSelect
            defaultValue={30}
            inputProps={{
              name: "age",
            }}
          >
            <option value={10}>Ten</option>
            <option value={20}>Twenty</option>
            <option value={30}>Thirty</option>
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

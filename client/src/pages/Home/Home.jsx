import { useState, useEffect, useRef } from "react";
import MangaCard from "../../components/mangaCard/MangaCard";
import styles from "./Home.module.css";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router";
import Select from "@mui/material/Select";
import NativeSelect from "@mui/material/NativeSelect";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
export default function Home() {
  const [mangaData, setMangaData] = useState([]);
  // using sessionstorage to get the last selected filter value
  const [filterSelect, setFilterSelect] = useState(
    sessionStorage.getItem("filterValue") || "",
  );
  const navigator = useNavigate();
  const scrollRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
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

  const getFilteredData = () => {
    let filteredArray = [...mangaData];
    switch (filterSelect) {
      case "rating-dsc":
        filteredArray.sort((a, b) => b.rating - a.rating);
        break;
      case "rating-asc":
        filteredArray.sort((a, b) => a.rating - b.rating);
        break;
      case "ch-dsc":
        filteredArray.sort((a, b) => b.bookmark - a.bookmark);
        break;
      case "ch-asc":
        filteredArray.sort((a, b) => a.bookmark - b.bookmark);
        break;
      case "status-finish":
        filteredArray = filteredArray.filter((manga) => manga.status === true);
        break;
      case "status-ongoing":
        filteredArray = filteredArray.filter((manga) => manga.status === false);
        break;
      case "":
        filteredArray = mangaData;
        break;
    }
    return filteredArray;
  };

  return (
    <>
      <div className={styles.homeBtn}>
        <FormControl size="small">
          <InputLabel variant="standard">Filter</InputLabel>
          <NativeSelect
            onChange={(e) => {
              //update the sessionStorage so it can be used the next time ui renders
              sessionStorage.setItem("filterValue", e.target.value);
              //update the selectFilter state so ui rerenders with the new filtered mangaData
              setFilterSelect(e.target.value);
            }}
            value={filterSelect}
          >
            <option value="" aria-label="None"></option>
            <option value={"status-finish"}>Finsihed</option>
            <option value={"status-ongoing"}>Ongoing</option>
            <option value={"rating-dsc"}>Rating (High to Low)</option>
            <option value={"rating-asc"}>Rating (Low to High)</option>
            <option value={"ch-dsc"}>Chapters (High to Low)</option>
            <option value={"ch-asc"}>Chapters (Low to High)</option>
          </NativeSelect>
        </FormControl>
        <Button
          sx={{ minWidth: 120 }}
          variant="contained"
          onClick={() => navigator("/add", { viewTransition: true })}
        >
          Add Manga
        </Button>
      </div>
      <div className={styles.classContainer}>
        {/* use the filtererd data from the fucntion to map => honest to teh user preference filterSelect */}
        {getFilteredData().map((currentManga) => {
          return (
            <MangaCard key={currentManga.id} currentManga={currentManga} />
          );
        })}
      </div>
    </>
  );
}

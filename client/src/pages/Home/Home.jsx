import { useState, useEffect } from "react";
import MangaCard from "../../components/mangaCard/MangaCard";
import styles from "./Home.module.css";
import Button from "@mui/material/Button";
import { NavLink, useNavigate, useOutletContext } from "react-router";
import NativeSelect from "@mui/material/NativeSelect";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";

export default function Home() {
  const [mangaData, setMangaData] = useState([]);
  const [isSignedIn, setIsSignedIn] = useOutletContext();
  const [filterSelect, setFilterSelect] = useState(
    sessionStorage.getItem("filterValue") || "",
  );
  const navigator = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    async function fetchMangaData() {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/mangadata`,
        { credentials: "include" },
      );
      const mangaObj = await response.json();
      setMangaData(mangaObj.mangaData);
    }
    fetchMangaData();
  }, []);
  useEffect(() => {
    if (mangaData.length === 0) {
      sessionStorage.removeItem("filterValue");
      setFilterSelect("");
    }
  }, [mangaData]);
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
      default:
        filteredArray = mangaData;
    }
    return filteredArray;
  };

  return (
    <>
      {isSignedIn ? (
        <>
          {mangaData.length != 0 && (
            <div className={styles.homeBtn}>
              <FormControl size="small">
                <InputLabel variant="standard">Filter</InputLabel>
                <NativeSelect
                  onChange={(e) => {
                    sessionStorage.setItem("filterValue", e.target.value);
                    setFilterSelect(e.target.value);
                  }}
                  value={filterSelect}
                >
                  <option value="" aria-label="None"></option>
                  <option value={"status-finish"}>Finished</option>
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
          )}
          {getFilteredData().length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>Your list is empty!</p>
              <p className={styles.emptyBody}>
                {filterSelect
                  ? "No manga match that filter. Try a different one."
                  : "Start building your collection by adding your first manga."}
              </p>
              {!filterSelect && (
                <Button
                  variant="contained"
                  onClick={() => navigator("/add", { viewTransition: true })}
                >
                  Add your first manga
                </Button>
              )}
            </div>
          ) : (
            <div className={styles.classContainer}>
              {getFilteredData().map((currentManga) => (
                <MangaCard key={currentManga.id} currentManga={currentManga} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={styles.guestContainer}>
          <span className={styles.guestEyebrow}>You're not signed in</span>
          <h1 className={styles.guestTitle}>
            Track your <span>manga</span> list.
          </h1>
          <p className={styles.guestBody}>
            Keep track of every manga you're reading, the chapter you left off,
            your ratings, your thoughts. All in one place.{" "}
            <strong>Sign in to see your list.</strong>
          </p>
          <div className={styles.guestActions}>
            <NavLink to="/" className={styles.btnPrimary}>
              Log in
            </NavLink>
            <div className={styles.divider}>
              <span>or</span>
            </div>
            <div className={styles.signupRow}>
              <p>New here?</p>
              <NavLink to="/signup" viewTransition>
                <button className={styles.btnGhost}>Create account</button>
              </NavLink>
            </div>
          </div>
          <p className={styles.aboutLink}>
            Curious about the app? <NavLink to="/about">Read the story</NavLink>
          </p>
        </div>
      )}
    </>
  );
}

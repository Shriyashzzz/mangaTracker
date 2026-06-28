import { useNavigate } from "react-router";
import styles from "./AddManga.module.css";
import { useRef, useState } from "react";
import Button from "@mui/material/Button";
import { useEffect } from "react";
export function AddManga() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(false);
  const statusRef = useRef(false);
  const formRef = useRef(null);
  const [validationError, setValidationError] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  });
  const handleStatusChange = () => {
    if (statusRef.current.value === "true") {
      setStatus(true);
    } else {
      setStatus(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setValidationError([]);
    const { name, description, image, status, genre, bookmark } =
      formRef.current;
    let sendReq = {
      name: name.value,
      description: description.value,
      image: image.value,
      genre: genre.value,
      status: status.value,
    };
    if (status.value === "false") {
      sendReq = {
        name: name.value,
        description: description.value,
        image: image.value,
        status: status.value,
        genre: genre.value,
        bookmark: bookmark.value,
      };
    }
    try {
      const resposne = await fetch(`${import.meta.env.VITE_API_URL}/add`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendReq),
      });
      const data = await resposne.json();
      if (data.error.length != 0) {
        await setValidationError(data.error);
      } else {
        setValidationError([]);
        navigate(`/details/${data.id}`);
      }
    } catch (e) {
      throw Error(e.msg);
    }
  };
  return (
    <div className={styles.container}>
      <form ref={formRef} onSubmit={(e) => handleFormSubmit(e)}>
        <h2 className={styles.formTitle}>Add Manga</h2>

        <label htmlFor="name">
          Title <b>*</b>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="e.g. Berserk"
          required
        />

        <label htmlFor="description">Description (optional) </label>
        <textarea
          id="description"
          name="description"
          placeholder="Your thoughts on the Manga…"
        />

        <label htmlFor="image">Cover Image URL (optional)</label>
        <input
          id="image"
          name="image"
          type="url"
          placeholder="https://example.com/cover.jpg"
        />
        <label htmlFor="genre">Genre (optional)</label>
        <select name="genre" id="genre">
          <option value="unlabled">-- Select a Genre --</option>
          <option value="Action">Action</option>
          <option value="Adventure">Adventure</option>
          <option value="Dark Fantasy">Dark Fantasy</option>
          <option value="Magical Girl">Magical Girl</option>
          <option value="Psychological Thriller">Psychological Thriller</option>
          <option value="Steampunk">Steampunk</option>
          <option value="Superhero">Superhero</option>
          <option value="Supernatural">Supernatural</option>

          <option value="Comedy">Comedy</option>
          <option value="Cyberpunk">Cyberpunk</option>
          <option value="Drama">Drama</option>
          <option value="Dystopian">Dystopian</option>
          <option value="Ecchi">Ecchi</option>
          <option value="Fantasy">Fantasy</option>
          <option value="Gourmet">Gourmet (Cooking)</option>
          <option value="Harem">Harem</option>
          <option value="Historical">Historical</option>
          <option value="Horror">Horror</option>
          <option value="Isekai">Isekai</option>
          <option value="Mecha">Mecha (Robots)</option>
          <option value="Military">Military</option>
          <option value="Mystery">Mystery</option>
          <option value="Post-Apocalyptic">Post-Apocalyptic</option>
          <option value="Romance">Romance</option>
          <option value="Sci-Fi">Sci-Fi</option>
          <option value="Slice of Life">Slice of Life</option>
          <option value="Sports">Sports</option>
          <option value="Suspense">Suspense</option>
          <option value="Thriller">Thriller</option>
        </select>

        <label htmlFor="status">
          Status <b>*</b>
        </label>
        <select
          ref={statusRef}
          id="status"
          name="status"
          onChange={handleStatusChange}
          required
        >
          <option value="false">Ongoing</option>
          <option value="true">Finished</option>
        </select>
        {!status && (
          <>
            {" "}
            <label htmlFor="name">Bookmark</label>
            <input
              id="bookmark"
              name="bookmark"
              type="number"
              placeholder="e.g. 1073"
              required
            />
          </>
        )}
        <div className={styles.errorList}>
          {validationError.length != 0 &&
            validationError.map((e) => {
              return <li key={e.msg}>{e.msg}</li>;
            })}
        </div>
        <div className={styles.btnContainer}>
          <Button type="submit">Add to Library</Button>
        </div>
      </form>
    </div>
  );
}

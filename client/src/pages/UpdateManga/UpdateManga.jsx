import { useNavigate, useParams } from "react-router";
import styles from "./UpdateManga.module.css";
import { useState, useEffect, useRef } from "react";
export function UpdateManga() {
  const navigation = useNavigate();
  const { id } = useParams();
  const [mangaData, setMangaData] = useState([]);
  const formRef = useRef(null);
  const nameRef = useRef(null);
  const descRef = useRef(null);
  const bookMarkRef = useRef(null);
  const selectRef = useRef(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    window.scrollTo(0, 0);

    const getThatManga = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/details/${id}`,
          { credentials: "include" },
        );
        if (!response.ok)
          throw new Error(`Error fetching data from the server`);
        const data = await response.json();
        setMangaData(data.detail);
      } catch (e) {
        console.error(e);
      }
    };

    getThatManga();
  }, []);

  const handleFormSubmission = async (e) => {
    e.preventDefault();
    let formData = {};
    if (selectRef.current.value === "true") {
      formData = {
        name: nameRef.current.value,
        description: descRef.current.value,
        status: selectRef.current.value,
      };
    } else {
      formData = {
        name: nameRef.current.value,
        description: descRef.current.value,
        bookmark: bookMarkRef.current.value,
        status: selectRef.current.value,
      };
    }
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/update/${id}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          status: formData.status,
          bookmark: formData.bookmark,
        }),
      },
    );
    if (response.status == 400) {
      const errorDara = await response.json();
      setError(errorDara.error);
    } else {
      setError(null);
      navigation(`/details/${id}`, { viewTransition: true });
    }
  };

  return (
    <div className={styles.container}>
      <form
        action={`/update/${id}/post`}
        ref={formRef}
        onSubmit={(e) => handleFormSubmission(e)}
      >
        <label htmlFor="manganame">Name: </label>
        <input
          defaultValue={mangaData.name}
          ref={nameRef}
          type="text"
          name="manganame"
          id="manganame"
        />
        <label htmlFor="desciption">Desciption: </label>
        <textarea
          ref={descRef}
          type="text"
          name="desciption"
          id="desciption"
          defaultValue={mangaData.description}
        />

        {!mangaData.status && (
          <>
            <label htmlFor="bookmark">Bookmark: </label>
            <input
              ref={bookMarkRef}
              type="number"
              name="bookmark"
              id="bookmark"
              defaultValue={mangaData.bookmark}
            />
          </>
        )}

        <select
          ref={selectRef}
          key={mangaData.status}
          name="status"
          id="status"
          defaultValue={mangaData.status ? "true" : "false"}
        >
          <option value="true">Finished</option>
          <option value="false">Not Finished</option>
        </select>
        {error && (
          <ul className={styles.errorList}>
            {error.map((e) => {
              return <li>{e.msg}</li>;
            })}
          </ul>
        )}
        <div className={styles.btnContainer}>
          <button
            onClick={() =>
              navigation(`/details/${id}`, { viewTransition: true })
            }
          >
            Go Back
          </button>
          <button type="submit">UPDATE</button>
        </div>
      </form>
    </div>
  );
}

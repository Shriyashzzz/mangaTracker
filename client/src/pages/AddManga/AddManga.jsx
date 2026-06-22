import styles from "./AddManga.module.css";
import { useRef, useState } from "react";
export function AddManga() {
  const [status, setStatus] = useState(false);
  const statusRef = useRef(false);

  const handleStatusChange = () => {
    if (statusRef.current.value === "true") {
      setStatus(true);
    } else {
      setStatus(false);
    }
  };
  return (
    <div className={styles.container}>
      <form action="/add" method="POST">
        <h2 className={styles.formTitle}>Add Manga</h2>

        <label htmlFor="name">Title</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="e.g. Berserk"
          required
        />

        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          placeholder="Brief synopsis or notes…"
        />

        <label htmlFor="image">Cover Image URL</label>
        <input
          id="image"
          name="image"
          type="text"
          placeholder="https://example.com/cover.jpg"
        />

        <label htmlFor="status">Status</label>
        <select
          ref={statusRef}
          id="status"
          name="status"
          onChange={handleStatusChange}
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
              type="text"
              placeholder="e.g. 1073"
              required
            />
          </>
        )}
        <div className={styles.btnContainer}>
          <button type="submit">Add to Library</button>
        </div>
      </form>
    </div>
  );
}

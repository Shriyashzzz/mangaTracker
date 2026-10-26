import { NavLink, useNavigate, useSearchParams } from "react-router";
import styles from "../../styles/Form.module.css";
import { useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { GENRES } from "../../lib/genres";
import CoverPicker from "../../components/coverPicker/CoverPicker";

const DESC_MAX = 450;

export function AddManga() {
  const navigate = useNavigate();
  const [isFinished, setIsFinished] = useState(false);
  const [searchParams] = useSearchParams();
  // "Add to my shelf" from the price checker passes the series name along
  const [title, setTitle] = useState(() =>
    (searchParams.get("title") ?? "").slice(0, 150),
  );
  const [image, setImage] = useState("");
  const [genre, setGenre] = useState("");
  const [genreFromAniList, setGenreFromAniList] = useState(false);
  // a genre the user picked by hand is never overwritten by a cover match
  const genreTouched = useRef(false);
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setValidationError([]);
    const form = new FormData(e.currentTarget);
    const sendReq = {
      name: title,
      description,
      image,
      genre,
      status: String(isFinished),
    };
    if (!isFinished) sendReq.bookmark = form.get("bookmark");

    setSubmitting(true);
    try {
      const response = await apiFetch("/add", {
        method: "POST",
        body: sendReq,
      });
      const data = await response.json();
      if (data.error.length != 0) {
        setValidationError(data.error);
      } else {
        navigate(`/details/${data.id}`, { viewTransition: true });
      }
    } catch {
      setValidationError([
        { msg: "Couldn't reach the server. Are you signed in?" },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles.page} fade-in`}>
      <div className={styles.pageHead}>
        <div>
          <NavLink to="/" className={styles.backLink} viewTransition>
            ← back to the shelf
          </NavLink>
          <h1 className={styles.formTitle}>New entry</h1>
        </div>
      </div>

      <form className={styles.sheet} onSubmit={handleFormSubmit}>
        <div className={`${styles.field} ${styles.titleField}`}>
          <label htmlFor="name">
            Title <b>*</b>
          </label>
          <input
            className={styles.input}
            id="name"
            name="name"
            type="text"
            placeholder="e.g. Berserk"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={3}
            maxLength={150}
            required
            autoFocus
          />
        </div>

        <CoverPicker
          className={styles.coverArea}
          title={title}
          value={image}
          onChange={(url, match) => {
            setImage(url);
            if (match?.genre && !genreTouched.current) {
              setGenre(match.genre);
              setGenreFromAniList(true);
            }
          }}
        />

        <div className={styles.details}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Status <b>*</b>
            </span>
            <div className={styles.segmented}>
              <input
                type="radio"
                id="status-ongoing"
                name="status"
                checked={!isFinished}
                onChange={() => setIsFinished(false)}
              />
              <label htmlFor="status-ongoing">Still reading</label>
              <input
                type="radio"
                id="status-finished"
                name="status"
                checked={isFinished}
                onChange={() => setIsFinished(true)}
              />
              <label htmlFor="status-finished">Finished it</label>
            </div>
          </div>

          <div className={styles.row}>
            {!isFinished && (
              <div className={styles.field}>
                <label htmlFor="bookmark">
                  Current chapter <b>*</b>
                </label>
                <input
                  className={styles.input}
                  inputMode="decimal"
                  id="bookmark"
                  name="bookmark"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 1073"
                  required
                />
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor="genre">
                Genre{" "}
                <span className={styles.optional}>
                  {genreFromAniList ? "(from AniList)" : "(optional)"}
                </span>
              </label>
              <select
                className={styles.input}
                name="genre"
                id="genre"
                value={genre}
                onChange={(e) => {
                  genreTouched.current = true;
                  setGenre(e.target.value);
                  setGenreFromAniList(false);
                }}
              >
                <option value="">Select a genre</option>
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${styles.field} ${styles.notesField}`}>
            <div className={styles.labelRow}>
              <label htmlFor="description">
                Notes <span className={styles.optional}>(optional)</span>
              </label>
              <span className={styles.counter}>
                {description.length}/{DESC_MAX}
              </span>
            </div>
            <textarea
              className={styles.input}
              id="description"
              name="description"
              placeholder="Your thoughts on the manga…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESC_MAX}
            />
          </div>

          {validationError.length != 0 && (
            <ul className={styles.errorList} role="alert">
              {validationError.map((e) => (
                <li key={e.msg}>{e.msg}</li>
              ))}
            </ul>
          )}

          <div className={styles.btnContainer}>
            <NavLink to="/" className="btn btn-ghost" viewTransition>
              Cancel
            </NavLink>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Adding…" : "Put it on the shelf"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

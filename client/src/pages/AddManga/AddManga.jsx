import { NavLink, useNavigate } from "react-router";
import styles from "../../styles/Form.module.css";
import { useState } from "react";
import { apiFetch } from "../../lib/api";
import { GENRES } from "../../lib/genres";
import CoverPicker from "../../components/coverPicker/CoverPicker";

const DESC_MAX = 450;

export function AddManga() {
  const navigate = useNavigate();
  const [isFinished, setIsFinished] = useState(false);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [imageBroken, setImageBroken] = useState(false);
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
      genre: form.get("genre"),
      status: String(isFinished),
    };
    if (!isFinished) sendReq.bookmark = form.get("bookmark");

    setSubmitting(true);
    try {
      const response = await apiFetch("/add", { method: "POST", body: sendReq });
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

  const showImage = image && !imageBroken;

  return (
    <div className={`${styles.page} fade-in`}>
      <NavLink to="/" className={styles.backLink} viewTransition>
        ← back to the shelf
      </NavLink>
      <h1 className={styles.formTitle}>New entry</h1>
      <p className={styles.formSub}>
        What are you reading? Write down where you are and I'll hold the page.
      </p>

      <div className={styles.layout}>
        <form className={styles.card} onSubmit={handleFormSubmit}>
          <div className={styles.field}>
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
              <label htmlFor="status-ongoing">
                Still reading
              </label>
              <input
                type="radio"
                id="status-finished"
                name="status"
                checked={isFinished}
                onChange={() => setIsFinished(true)}
              />
              <label htmlFor="status-finished">
                Finished it
              </label>
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
                Genre <span className={styles.optional}>(optional)</span>
              </label>
              <select
                className={styles.input}
                name="genre"
                id="genre"
                defaultValue=""
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

          <CoverPicker
            title={title}
            value={image}
            onChange={(url) => {
              setImage(url);
              setImageBroken(false);
            }}
          />

          <div className={styles.field}>
            <label htmlFor="description">
              Notes <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              className={styles.input}
              id="description"
              name="description"
              placeholder="Your thoughts on the manga…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESC_MAX}
            />
            <div className={styles.hintRow}>
              <span>At least 10 characters if you add notes</span>
              <span>
                {description.length}/{DESC_MAX}
              </span>
            </div>
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
        </form>

        <aside className={styles.preview} aria-hidden>
          <span className={styles.previewLabel}>how it'll look →</span>
          <div
            className={`${styles.previewCover} ${
              showImage ? styles.hasImage : ""
            }`}
          >
            {showImage ? (
              <img src={image} alt="" onError={() => setImageBroken(true)} />
            ) : imageBroken ? (
              "hm, that link isn't loading as an image"
            ) : (
              "type a title and pick a cover"
            )}
          </div>
          <span className={styles.previewTitle}>
            {title || "untitled"}
          </span>
        </aside>
      </div>
    </div>
  );
}

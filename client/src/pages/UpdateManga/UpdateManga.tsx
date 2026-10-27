import { NavLink, useNavigate, useParams } from "react-router";
import { formStyles as styles } from "../../styles/form";
import { useState, useEffect, type FormEvent } from "react";
import { apiFetch, errorMessages } from "../../lib/api";
import type { Manga, MangaForm } from "../../lib/types";
import CoverPicker from "../../components/coverPicker/CoverPicker";
import { usePrivatePage } from "../../lib/seo";

const DESC_MAX = 450;

export function UpdateManga() {
  usePrivatePage("Edit manga");
  const navigation = useNavigate();
  const { id } = useParams();
  const [mangaData, setMangaData] = useState<Manga | null>(null);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [isFinished, setIsFinished] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<{ msg: string }[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const getThatManga = async () => {
      try {
        const response = await apiFetch(`/api/manga/${id}`);
        if (!response.ok)
          throw new Error(`Error fetching data from the server`);
        const { manga } = (await response.json()) as { manga: Manga };
        setMangaData(manga);
        setIsFinished(manga.status);
        setDescription(manga.description ?? "");
        setTitle(manga.name);
        setImage(manga.image ?? "");
      } catch (e) {
        console.error(e);
        setError([{ msg: "Couldn't load this manga. Are you signed in?" }]);
      }
    };

    getThatManga();
  }, [id]);

  const handleFormSubmission = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const formData: MangaForm = {
      name: title,
      image,
      description,
      status: isFinished,
      volumesOwned: String(form.get("volumesOwned") ?? ""),
    };
    if (!isFinished) formData.bookmark = String(form.get("bookmark") ?? "");

    setSubmitting(true);
    try {
      const response = await apiFetch(`/api/manga/${id}`, {
        method: "PUT",
        body: formData,
      });
      if (response.status == 400) {
        setError((await errorMessages(response)).map((msg) => ({ msg })));
      } else if (!response.ok) {
        setError([{ msg: "Something went wrong, please try again." }]);
      } else {
        setError(null);
        navigation(`/details/${id}`, { viewTransition: true });
      }
    } catch {
      setError([{ msg: "Couldn't reach the server." }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles.page} fade-in`}>
      <div className={styles.pageHead}>
        <div>
          <NavLink
            to={`/details/${id}`}
            className={styles.backLink}
            viewTransition
          >
            ← back
          </NavLink>
          <h1 className={styles.formTitle}>Edit entry</h1>
        </div>
        <p className={styles.formSub}>
          Read a few more chapters? Move your bookmark up.
        </p>
      </div>

      <div>
        {!mangaData ? (
          error ? (
            <ul className={styles.errorList} role="alert">
              {error.map((e) => (
                <li key={e.msg}>{e.msg}</li>
              ))}
            </ul>
          ) : (
            <div
              className="skeleton"
              style={{ height: 520, borderRadius: "var(--radius)" }}
            />
          )
        ) : (
          <form className={styles.sheet} onSubmit={handleFormSubmission}>
            <div className={`${styles.field} ${styles.titleField}`}>
              <label htmlFor="manganame" className={styles.label}>
                Title <b>*</b>
              </label>
              <input
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text"
                name="manganame"
                id="manganame"
                minLength={3}
                maxLength={150}
                required
              />
            </div>

            <CoverPicker
              className={styles.coverArea}
              title={title}
              value={image}
              onChange={setImage}
            />

            <div className={styles.details}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Status</span>
                <div className={styles.segmented}>
                  <input
                    type="radio"
                    id="status-ongoing"
                    name="status"
                    checked={!isFinished}
                    onChange={() => setIsFinished(false)}
                  />
                  <label htmlFor="status-ongoing" className={styles.segmentLabel}>Still reading</label>
                  <input
                    type="radio"
                    id="status-finished"
                    name="status"
                    checked={isFinished}
                    onChange={() => setIsFinished(true)}
                  />
                  <label htmlFor="status-finished" className={styles.segmentLabel}>Finished it</label>
                </div>
              </div>

              <div className={styles.row}>
                {!isFinished && (
                  <div className={styles.field}>
                    <label htmlFor="bookmark" className={styles.label}>Current chapter</label>
                    <input
                      className={styles.input}
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="any"
                      name="bookmark"
                      id="bookmark"
                      defaultValue={mangaData.bookmark ?? ""}
                    />
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor="volumesOwned" className={styles.label}>
                    Own up to vol.{" "}
                    <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    id="volumesOwned"
                    name="volumesOwned"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 14"
                    defaultValue={mangaData.volumesOwned ?? ""}
                  />
                </div>
              </div>

              <div className={`${styles.field} ${styles.notesField}`}>
                <div className={styles.labelRow}>
                  <label htmlFor="description" className={styles.label}>
                    Notes <span className={styles.optional}>(optional)</span>
                  </label>
                  <span className={styles.counter}>
                    {description.length}/{DESC_MAX}
                  </span>
                </div>
                <textarea
                  className={styles.textarea}
                  name="description"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={DESC_MAX}
                />
              </div>

              {error && (
                <ul className={styles.errorList} role="alert">
                  {error.map((e) => (
                    <li key={e.msg}>{e.msg}</li>
                  ))}
                </ul>
              )}

              <div className={styles.btnContainer}>
                <NavLink
                  to={`/details/${id}`}
                  className="btn btn-ghost"
                  viewTransition
                >
                  Cancel
                </NavLink>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

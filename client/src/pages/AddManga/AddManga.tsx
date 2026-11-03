import { NavLink, useNavigate, useSearchParams } from "react-router";
import { formStyles as styles } from "../../styles/form";
import { useRef, useState, type FormEvent } from "react";
import { apiFetch, errorMessages, signInPath } from "../../lib/api";
import type { MangaForm } from "../../lib/types";
import { useAuth } from "../../store/auth";
import { GENRES } from "../../lib/genres";
import CoverPicker from "../../components/coverPicker/CoverPicker";
import type { CoverHit } from "../../lib/anilist";
import TitleField from "./TitleField";
import FormatField from "../../components/formatField/FormatField";
import { useEffect } from "react";
import { usePrivatePage } from "../../lib/seo";

const DESC_MAX = 450;

export function AddManga() {
  usePrivatePage("Add manga");
  const navigate = useNavigate();
  const isSignedIn = useAuth((s) => s.isSignedIn);
  // still reading, finished it, or want to read (not started, so no chapter)
  const [stage, setStage] = useState<"reading" | "finished" | "planned">(
    "reading",
  );
  const isFinished = stage === "finished";
  const [searchParams] = useSearchParams();
  // "Add to my shelf" from the price checker passes the series name along
  const [title, setTitle] = useState(() =>
    (searchParams.get("title") ?? "").slice(0, 150),
  );
  const [image, setImage] = useState("");
  // AniList's guesses at the title, and whether they've picked one of them
  const [found, setFound] = useState<{ query: string; hits: CoverHit[] }>({
    query: "",
    hits: [],
  });
  const [pickedTitle, setPickedTitle] = useState<string | null>(null);
  // the suggestion under the mouse: its cover shows until they move away
  const [preview, setPreview] = useState<CoverHit | null>(null);
  const [genre, setGenre] = useState("");
  // set by the AniList title they pick, until they choose it themselves
  const [lightNovel, setLightNovel] = useState(false);
  const formatTouched = useRef(false);
  const [genreFromAniList, setGenreFromAniList] = useState(false);
  // a genre the user picked by hand is never overwritten by a cover match
  const genreTouched = useRef(false);
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<{ msg: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // signed-out visitors go to sign in, then come back here. null means the
  // server hasn't answered yet, so wait rather than bounce a signed-in user
  useEffect(() => {
    if (isSignedIn === false) {
      navigate(signInPath(`/add?${searchParams}`), { replace: true });
    }
  }, [isSignedIn, navigate, searchParams]);

  const pickTitle = (hit: CoverHit) => {
    setTitle(hit.title);
    setPickedTitle(hit.title);
    setImage(hit.cover);
    if (!formatTouched.current) setLightNovel(hit.lightNovel);
    if (hit.genre && !genreTouched.current) {
      setGenre(hit.genre);
      setGenreFromAniList(true);
    }
  };
  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError([]);
    const form = new FormData(e.currentTarget);
    const sendReq: MangaForm = {
      name: title,
      description,
      image,
      genre,
      status: isFinished,
      planned: stage === "planned",
      lightNovel,
      volumesOwned: String(form.get("volumesOwned") ?? ""),
    };
    if (stage === "reading")
      sendReq.bookmark = String(form.get("bookmark") ?? "");

    setSubmitting(true);
    try {
      const response = await apiFetch("/api/manga", {
        method: "POST",
        body: sendReq,
      });
      if (response.ok) {
        const { id } = (await response.json()) as { id: number };
        navigate(`/details/${id}`, { viewTransition: true, replace: true });
      } else {
        const messages = await errorMessages(response);
        setValidationError(messages.map((msg) => ({ msg })));
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
          <NavLink to="/shelf" className={styles.backLink} viewTransition>
            ← back to the shelf
          </NavLink>
          <h1 className={styles.formTitle}>New entry</h1>
        </div>
      </div>

      <form className={styles.sheet} onSubmit={handleFormSubmit}>
        <div
          className={`${styles.field} ${styles.titleField}`}
          data-tour="add-title"
        >
          <label htmlFor="name" className={styles.label}>
            Title <b>*</b>
          </label>
          <TitleField
            value={title}
            onChange={setTitle}
            hits={
              found.query === title.trim() && pickedTitle !== title
                ? found.hits
                : []
            }
            onPick={pickTitle}
            onPreview={setPreview}
          />
        </div>

        <CoverPicker
          className={styles.coverArea}
          title={title}
          value={image}
          previewUrl={preview?.cover}
          coverChosen={pickedTitle === title}
          onResults={(hits, query) => setFound({ query, hits })}
          onChange={(url, match) => {
            setImage(url);
            if (match?.genre && !genreTouched.current) {
              setGenre(match.genre);
              setGenreFromAniList(true);
            }
          }}
        />

        <div className={styles.details}>
          <FormatField
            lightNovel={lightNovel}
            onChange={(value) => {
              formatTouched.current = true;
              setLightNovel(value);
            }}
          />
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Status <b>*</b>
            </span>
            <div className={styles.segmented}>
              <input
                type="radio"
                id="status-ongoing"
                name="status"
                checked={stage === "reading"}
                onChange={() => setStage("reading")}
              />
              <label htmlFor="status-ongoing" className={styles.segmentLabel}>
                Still reading
              </label>
              <input
                type="radio"
                id="status-finished"
                name="status"
                checked={isFinished}
                onChange={() => setStage("finished")}
              />
              <label htmlFor="status-finished" className={styles.segmentLabel}>
                Finished it
              </label>
              <input
                type="radio"
                id="status-planned"
                name="status"
                checked={stage === "planned"}
                onChange={() => setStage("planned")}
              />
              <label htmlFor="status-planned" className={styles.segmentLabel}>
                Want to read
              </label>
            </div>
          </div>

          <div className={styles.row}>
            {stage === "reading" && (
              <div className={styles.field}>
                <label htmlFor="bookmark" className={styles.label}>
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
                defaultValue={searchParams.get("volumesOwned") ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="genre" className={styles.label}>
                Genre{" "}
                <span className={styles.optional}>
                  {genreFromAniList ? "(from AniList)" : "(optional)"}
                </span>
              </label>
              <select
                className={styles.select}
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
              <label htmlFor="description" className={styles.label}>
                Notes <span className={styles.optional}>(optional)</span>
              </label>
              <span className={styles.counter}>
                {description.length}/{DESC_MAX}
              </span>
            </div>
            <textarea
              className={styles.textarea}
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
            <NavLink
              to="/shelf"
              className="btn btn-ghost"
              viewTransition
              replace
            >
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

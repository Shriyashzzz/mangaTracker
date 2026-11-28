import { SortMenu } from "../Home/ShelfBar";
import PlaceField from "../../components/placeField/PlaceField";
import { tracksOf } from "../../lib/reading";
import { useTrackBy } from "../../lib/prefs";
import { NavLink, useNavigate, useParams } from "react-router";
import { formStyles as styles } from "../../styles/form";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { apiFetch, errorMessages } from "../../lib/api";
import type { Manga } from "../../lib/types";
import CoverPicker, {
  type OwnCover,
} from "../../components/coverPicker/CoverPicker";
import { getBooks } from "../../lib/booksApi";
import { ownCoversOf } from "../../lib/books";
import FormatField from "../../components/formatField/FormatField";
import { usePrivatePage } from "../../lib/seo";
import { GENRES } from "../../lib/content/genres";
import { useVolumePicker } from "../../components/volumePicker/VolumePicker";
import StatusField, {
  type Stage,
} from "../../components/statusField/StatusField";
import { useBuyOptions } from "../Details/useBuyOptions";
import { useEditions } from "../Details/useEditions";
import { slotsOf } from "../../lib/editionShelf";
import { todayOf } from "../../lib/editionNews";
import { ownedOf } from "../../lib/ownedVolumes";
import { priceName } from "../../lib/prices";
import {
  firstProblemField,
  problemsIn,
  requestFor,
  type SeriesFormValues,
} from "../../lib/seriesFormRules";

const DESC_MAX = 450;

export function UpdateManga() {
  usePrivatePage("Edit manga");
  const navigation = useNavigate();
  const { id } = useParams();
  const [mangaData, setMangaData] = useState<Manga | null>(null);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [genre, setGenre] = useState("");
  const [stage, setStage] = useState<Stage>("reading");
  // said under the field it's about, rather than by the browser
  const [titleError, setTitleError] = useState("");
  const [chapterError, setChapterError] = useState<string>();
  const [imageError, setImageError] = useState<string>();
  // covers of the books they own of it, for the picker (none on failure:
  // the picker is whole without them)
  const [ownCovers, setOwnCovers] = useState<OwnCover[]>([]);
  const titleInput = useRef<HTMLInputElement>(null);
  const [lightNovel, setLightNovel] = useState(false);
  const [chapter, setChapter] = useState("");
  const [readVolume, setReadVolume] = useState("");
  const [byVolume, setByVolume] = useState(false);
  const trackBy = useTrackBy();
  const tracks = tracksOf({ byVolume }, trackBy);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<{ msg: string }[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // how many volumes are out, as the details page knows it, so the picker
  // stops there and says "of 113"
  const series = useBuyOptions(mangaData ? priceName(mangaData) : null, {
    volumesOwned: mangaData?.volumesOwned ?? null,
    ownedList: mangaData?.ownedList,
  });
  // the edition they collect: the picker then holds its books, as the
  // details page's shelf does. Only with the number of volumes out known
  const editions = useEditions(
    mangaData && !mangaData.lightNovel ? priceName(mangaData) : null,
    mangaData?.id ?? null,
    mangaData?.edition,
    mangaData ? ownedOf(mangaData) : [],
    series.volumes.map((v) => v.isbn13),
  );
  const out = series.latest?.volume ?? null;
  const volumes = useVolumePicker(
    { volumesOwned: null },
    out,
    editions.line && out
      ? {
          line: editions.line,
          slots: slotsOf(editions.line, out, todayOf(), editions.keptWhole),
        }
      : null,
  );
  const { reset: resetVolumes } = volumes;
  // once the manga's here, the picker starts from what it has
  const loadedId = mangaData?.id;
  useEffect(() => {
    if (mangaData) resetVolumes(mangaData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  useEffect(() => {
    const getThatManga = async () => {
      try {
        const response = await apiFetch(`/api/manga/${id}`);
        // not theirs, or not there: said plainly, not "are you signed in?"
        if (response.status === 403 || response.status === 404) {
          setError([{ msg: "This one isn't on your shelf." }]);
          return;
        }
        if (response.status === 401) {
          setError([{ msg: "Sign in to edit your shelf." }]);
          return;
        }
        if (!response.ok)
          throw new Error(`Error fetching data from the server`);
        const { manga } = (await response.json()) as { manga: Manga };
        getBooks(manga.id)
          .then((books) => setOwnCovers(ownCoversOf(books)))
          .catch(() => {});
        setMangaData(manga);
        setStage(
          manga.planned ? "planned" : manga.status ? "finished" : "reading",
        );
        setLightNovel(Boolean(manga.lightNovel));
        setChapter(String(manga.bookmark ?? ""));
        setReadVolume(String(manga.readVolume ?? ""));
        setByVolume(Boolean(manga.byVolume));
        setDescription(manga.description ?? "");
        setTitle(manga.name);
        setImage(manga.image ?? "");
        setGenre(manga.genre && manga.genre !== "unlabled" ? manga.genre : "");
      } catch (e) {
        console.error(e);
        setError([
          {
            msg: "Couldn't load this manga. Check your connection and try again.",
          },
        ]);
      }
    };

    getThatManga();
  }, [id]);

  const handleFormSubmission = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values: SeriesFormValues = {
      title,
      stage,
      chapter,
      readVolume,
      tracks,
      byVolume,
      // the edit form doesn't rate: the stars are on the series' page
      rating: 0,
      image,
      ownCover: true,
      genre,
      description,
      lightNovel,
      volumesOwned: String(form.get("volumesOwned") ?? ""),
      ownedList: String(form.get("ownedList") ?? ""),
    };
    const problems = problemsIn(values);
    setChapterError(problems.bookmark);
    setImageError(problems.image);
    if (problems.title) {
      setTitleError(problems.title);
      titleInput.current?.focus();
      return;
    }
    const fieldId = firstProblemField(problems);
    if (fieldId) {
      document.getElementById(fieldId)?.focus();
      return;
    }
    const formData = requestFor(values);

    setSubmitting(true);
    try {
      const response = await apiFetch(`/api/manga/${id}`, {
        method: "PUT",
        body: formData,
      });
      // 400: what's wrong with the form; 409: that title is already on the shelf
      if (response.status === 400 || response.status === 409) {
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

  // a genre AniList gave that isn't in our list still shows
  const genreIsOurs = !genre || GENRES.some((g) => g.value === genre);
  const genreOptions = [
    { value: "", label: "Select a genre" },
    ...(genreIsOurs ? [] : [{ value: genre, label: genre }]),
    ...GENRES,
  ];

  return (
    <div className={`${styles.page} fade-in`}>
      <div className={styles.pageHead}>
        <div>
          <NavLink
            to={`/details/${id}`}
            // the app's top bar has its own back arrow (index.css web-back)
            className={`${styles.backLink} web-back`}
            viewTransition
          >
            ← back to the series
          </NavLink>
          <h1 className={styles.formTitle}>Edit details</h1>
          <p className={styles.formSub}>
            Fix the title, cover or genre, or update where you're up to.
          </p>
        </div>
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
          <form
            className={styles.sheet}
            onSubmit={handleFormSubmission}
            noValidate
          >
            <div className={`${styles.field} ${styles.titleField}`}>
              <label htmlFor="manganame" className={styles.label}>
                Title <b>*</b>
              </label>
              <input
                ref={titleInput}
                className={`${styles.input} ${titleError ? styles.invalid : ""}`}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleError("");
                }}
                type="text"
                name="manganame"
                id="manganame"
                maxLength={150}
                required
                aria-invalid={Boolean(titleError) || undefined}
                aria-describedby={titleError ? "manganame-error" : undefined}
              />
              {titleError && (
                <p id="manganame-error" className={styles.fieldError}>
                  {titleError}
                </p>
              )}
            </div>

            <CoverPicker
              className={styles.coverArea}
              title={title}
              value={image}
              error={imageError}
              ownCovers={ownCovers}
              onChange={(url) => {
                setImage(url);
                setImageError(undefined);
              }}
            />

            <div className={styles.details}>
              <FormatField lightNovel={lightNovel} onChange={setLightNovel} />
              <StatusField
                stage={stage}
                onChange={(next) => {
                  setStage(next);
                  setChapterError(undefined);
                }}
              />

              <div className={styles.row}>
                {stage === "reading" && (
                  <PlaceField
                    mode={trackBy}
                    byVolume={byVolume}
                    onByVolume={setByVolume}
                    chapter={chapter}
                    onChapter={(next) => {
                      setChapter(next);
                      setChapterError(undefined);
                    }}
                    volume={readVolume}
                    onVolume={setReadVolume}
                    chapterError={chapterError}
                    classes={styles}
                  />
                )}
                <div className={styles.field}>
                  <label htmlFor="genre" className={styles.label}>
                    Genre <span className={styles.optional}>(optional)</span>
                  </label>
                  <div className={styles.pick}>
                    <SortMenu
                      box
                      id="genre"
                      menuLabel="Genre"
                      options={genreOptions}
                      sortBy={genre}
                      onSort={setGenre}
                    />
                  </div>
                </div>
              </div>
              {volumes.field}

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

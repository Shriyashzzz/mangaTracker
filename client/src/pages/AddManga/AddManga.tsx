import { NavLink, useNavigate, useSearchParams } from "react-router";
import { formStyles as styles } from "../../styles/form";
import { lazy, Suspense, useRef, useState, type FormEvent } from "react";
import { BarcodeIcon } from "../../components/icons/Icons";
// the camera and its barcode library load only when someone scans
const ScanSheet = lazy(() => import("../../components/scanSheet/ScanSheet"));
import { apiFetch, errorMessages, signInPath } from "../../lib/api";
import type { MangaForm } from "../../lib/types";
import { useAuth } from "../../store/auth";
import { GENRES } from "../../lib/content/genres";
import CoverPicker from "../../components/coverPicker/CoverPicker";
import type { CoverHit } from "../../lib/anilist";
import TitleField from "./TitleField";
import FormatField from "../../components/formatField/FormatField";
import { useEffect } from "react";
import { usePrivatePage } from "../../lib/seo";
import { useVolumePicker } from "../../components/volumePicker/VolumePicker";
import { parseVolumes } from "../../lib/ownedVolumes";
import StatusField, {
  type Stage,
} from "../../components/statusField/StatusField";
import { useBuyOptions } from "../Details/useBuyOptions";
import { priceName } from "../../lib/prices";
import { chapterProblem, coverLinkProblem } from "../../lib/formChecks";

const DESC_MAX = 450;

export function AddManga() {
  usePrivatePage("Add manga");
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();
  const isSignedIn = useAuth((s) => s.isSignedIn);
  // still reading, finished it, or want to read (not started, so no chapter)
  const [stage, setStage] = useState<Stage>("reading");
  // said under the field it's about, rather than by the browser
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    bookmark?: string;
    image?: string;
  }>({});
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
  // set by the AniList title they pick, until they choose it themselves. A
  // light novel's price page says so up front (format=novel)
  const novelFromPrices = searchParams.get("format") === "novel";
  const [lightNovel, setLightNovel] = useState(novelFromPrices);
  const formatTouched = useRef(novelFromPrices);
  const [genreFromAniList, setGenreFromAniList] = useState(false);
  // a genre the user picked by hand is never overwritten by a cover match
  const genreTouched = useRef(false);
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<{ msg: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // from a volume's price page: they own that one volume (older links said
  // "up to" it)
  const fromVolume = Number(searchParams.get("ownedVolume")) || null;
  // once they've picked a series, how many volumes are out, so the picker
  // stops there and says "of 113"
  const series = useBuyOptions(
    pickedTitle ? priceName({ name: pickedTitle, lightNovel }) : null,
    { volumesOwned: null },
  );
  const volumes = useVolumePicker(
    {
      volumesOwned:
        fromVolume ?? (Number(searchParams.get("volumesOwned")) || null),
      ownedList: fromVolume ? [fromVolume] : [],
    },
    series.latest?.volume ?? null,
  );
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
    const chapter = String(form.get("bookmark") ?? "");
    const missing = {
      title: !title.trim() ? "Give it a title." : undefined,
      bookmark:
        stage !== "reading"
          ? undefined
          : !chapter.trim()
            ? "Which chapter are you on? 0 if you haven't started."
            : chapterProblem(chapter),
      image: coverLinkProblem(image),
    };
    setFieldErrors(missing);
    const first = missing.title
      ? "name"
      : missing.bookmark
        ? "bookmark"
        : missing.image
          ? "cover-link"
          : null;
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    const sendReq: MangaForm = {
      name: title,
      description,
      image,
      genre,
      status: isFinished,
      planned: stage === "planned",
      lightNovel,
      volumesOwned: String(form.get("volumesOwned") ?? ""),
      ownedList: parseVolumes(String(form.get("ownedList") ?? "")) ?? [],
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
        {/* a stack of volumes on the desk: scan them in, with the webcam or a
            phone's camera, instead of typing each one */}
        <button
          type="button"
          className="btn btn-secondary self-end"
          onClick={() => setScanning(true)}
          // its code starts loading on the way to a click
          onPointerEnter={() =>
            void import("../../components/scanSheet/ScanSheet")
          }
          onFocus={() => void import("../../components/scanSheet/ScanSheet")}
        >
          <BarcodeIcon className="size-5" />
          Scan a barcode
        </button>
      </div>
      {scanning && (
        <Suspense fallback={null}>
          <ScanSheet onClose={() => setScanning(false)} />
        </Suspense>
      )}

      <form className={styles.sheet} onSubmit={handleFormSubmit} noValidate>
        <div
          className={`${styles.field} ${styles.titleField}`}
          data-tour="add-title"
        >
          <label htmlFor="name" className={styles.label}>
            Title <b>*</b>
          </label>
          <TitleField
            value={title}
            error={fieldErrors.title}
            onChange={(next) => {
              setTitle(next);
              setFieldErrors((e) => ({ ...e, title: undefined }));
            }}
            hits={
              found.query === title.trim() && pickedTitle !== title
                ? found.hits
                : []
            }
            onPick={pickTitle}
            onPreview={setPreview}
          />
          {fieldErrors.title && (
            <p id="name-error" className={styles.fieldError}>
              {fieldErrors.title}
            </p>
          )}
        </div>

        <CoverPicker
          className={styles.coverArea}
          title={title}
          value={image}
          error={fieldErrors.image}
          previewUrl={preview?.cover}
          coverChosen={pickedTitle === title}
          onResults={(hits, query) => setFound({ query, hits })}
          onChange={(url, match) => {
            setImage(url);
            setFieldErrors((e) => ({ ...e, image: undefined }));
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
          <StatusField
            stage={stage}
            onChange={(next) => {
              setStage(next);
              // a chapter it asked for may not be asked for now
              setFieldErrors((e) => ({ ...e, bookmark: undefined }));
            }}
            required
          />

          <div className={styles.row}>
            {stage === "reading" && (
              <div className={styles.field}>
                <label htmlFor="bookmark" className={styles.label}>
                  Current chapter <b>*</b>
                </label>
                <input
                  className={`${styles.input} ${fieldErrors.bookmark ? styles.invalid : ""}`}
                  inputMode="decimal"
                  id="bookmark"
                  name="bookmark"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 1073"
                  required
                  aria-invalid={Boolean(fieldErrors.bookmark) || undefined}
                  aria-describedby={
                    fieldErrors.bookmark ? "bookmark-error" : undefined
                  }
                  onChange={() =>
                    setFieldErrors((e) => ({ ...e, bookmark: undefined }))
                  }
                />
                {fieldErrors.bookmark && (
                  <p id="bookmark-error" className={styles.fieldError}>
                    {fieldErrors.bookmark}
                  </p>
                )}
              </div>
            )}
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
              id="description"
              name="description"
              placeholder={
                lightNovel
                  ? "Your thoughts on the novel…"
                  : "Your thoughts on the manga…"
              }
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

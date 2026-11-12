import { NavLink, useNavigate, useSearchParams } from "react-router";
import { formStyles as styles } from "../../styles/form";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  LinkIcon,
} from "../../components/icons/Icons";
import { apiFetch, errorMessages, signInPath } from "../../lib/api";
import type { MangaForm } from "../../lib/types";
import { useAuth } from "../../store/auth";
import { GENRES } from "../../lib/content/genres";
import type { CoverHit } from "../../lib/anilist";
import { useCoverSearch } from "../../components/coverPicker/useCoverSearch";
import TitleField from "./TitleField";
import FormatField from "../../components/formatField/FormatField";
import { usePrivatePage } from "../../lib/seo";
import { useVolumePicker } from "../../components/volumePicker/VolumePicker";
import { parseVolumes } from "../../lib/ownedVolumes";
import StatusField, {
  type Stage,
} from "../../components/statusField/StatusField";
import { useBuyOptions } from "../Details/useBuyOptions";
import { priceName } from "../../lib/prices";
import { chapterProblem, coverLinkProblem } from "../../lib/formChecks";
import { findOnShelf } from "../../lib/shelf";
import PlaceField from "../../components/placeField/PlaceField";
import { tracksOf } from "../../lib/reading";
import { useTrackBy } from "../../lib/prefs";
import StarRating from "../../components/starRating/StarRating";
import type { ShelfMatch } from "../../lib/types";

const DESC_MAX = 450;
// AniList's matches in the title dropdown
const MATCHES = 12;
// whether they left "More about it" open last time
const MORE_KEY = "addMoreOpen";

// The add page, in two parts on one page: search the title and pick the
// series (or keep what they typed), then the rest opens under it. Only
// what's needed to save shows; everything optional is folded into "More
// about it", which remembers being left open
export function AddManga() {
  usePrivatePage("Add manga");
  const navigate = useNavigate();
  const isSignedIn = useAuth((s) => s.isSignedIn);
  // still reading, finished it, or want to read (not started, so no chapter)
  const [stage, setStage] = useState<Stage>("reading");
  // kept here rather than in the box: the box goes when they press Change or
  // pick another status, and what they typed must survive that. 0 to start,
  // so a first save goes through
  const [chapter, setChapter] = useState("0");
  const [readVolume, setReadVolume] = useState("");
  // by the volume or the chapter: a light novel by the volume until they say
  const [byVolumeChoice, setByVolumeChoice] = useState<boolean | null>(null);
  const trackBy = useTrackBy();
  // stars, if they want to give some now (the details page rates too)
  const [rating, setRating] = useState(0);
  // said under the field it's about, rather than by the browser
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    bookmark?: string;
    image?: string;
  }>({});
  const isFinished = stage === "finished";
  const [searchParams] = useSearchParams();
  // "Add to my shelf" from the price checker passes the series name along
  const fromPrices = (searchParams.get("title") ?? "").slice(0, 150);
  const [title, setTitle] = useState(fromPrices);
  // the series they picked from AniList's matches; null for as typed
  const [picked, setPicked] = useState<CoverHit | null>(null);
  // past the search: the rest of the form is open. A title from the price
  // checker starts there, and its own match is picked once AniList answers
  const [chosen, setChosen] = useState(Boolean(fromPrices));
  const [image, setImage] = useState("");
  // their own cover link, open only once they ask for it
  const [ownCover, setOwnCover] = useState(false);
  const [brokenCover, setBrokenCover] = useState<string | null>(null);
  const [genre, setGenre] = useState("");
  // set by the AniList title they pick, until they choose it themselves. A
  // light novel's price page says so up front (format=novel)
  const novelFromPrices = searchParams.get("format") === "novel";
  const [lightNovel, setLightNovel] = useState(novelFromPrices);
  // the series already on their shelf under this title, found once it's
  // chosen: said before they fill the rest in, with the way to it (the
  // server still refuses a second copy on saving)
  const [already, setAlready] = useState<{
    title: string;
    match: NonNullable<ShelfMatch>;
  } | null>(null);
  useEffect(() => {
    const name = title.trim();
    if (!chosen || !name || !isSignedIn) return;
    const controller = new AbortController();
    findOnShelf(name, controller.signal)
      .then((match) => setAlready(match ? { title, match } : null))
      // can't tell: no note, and saving still says so
      .catch(() => {});
    return () => controller.abort();
  }, [chosen, title, isSignedIn]);
  const formatTouched = useRef(novelFromPrices);
  const byVolume = byVolumeChoice ?? lightNovel;
  const tracks = tracksOf({ byVolume }, trackBy);
  // "978-1-4215-3444-2" typed as a title
  const digits = title.replace(/[\s-]/g, "");
  const typedIsbn = /^(97[89]\d{10}|\d{9}[\dXx])$/.test(digits) ? digits : null;
  const [genreFromAniList, setGenreFromAniList] = useState(false);
  // a genre the user picked by hand is never overwritten by a match
  const genreTouched = useRef(false);
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<{ msg: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // from a volume's price page: they own that one volume (older links said
  // "up to" it)
  const fromVolume = Number(searchParams.get("ownedVolume")) || null;
  const volumesFromLink =
    fromVolume ?? (Number(searchParams.get("volumesOwned")) || null);
  // open when a link brought volumes along, so they see them; else as
  // they left it
  const [moreOpen, setMoreOpen] = useState(
    () => Boolean(volumesFromLink) || localStorage.getItem(MORE_KEY) === "1",
  );
  // once they've picked a series, how many volumes are out, so the picker
  // stops there and says "of 113"
  const series = useBuyOptions(
    picked ? priceName({ name: picked.title, lightNovel }) : null,
    { volumesOwned: null },
  );
  const volumes = useVolumePicker(
    {
      volumesOwned: volumesFromLink,
      ownedList: fromVolume ? [fromVolume] : [],
    },
    series.latest?.volume ?? null,
  );

  // the price checker's title gets its match picked once, unless they've
  // chosen something themselves first
  const autoPick = useRef(Boolean(fromPrices));
  const pickTitle = (hit: CoverHit) => {
    autoPick.current = false;
    setTitle(hit.title);
    setPicked(hit);
    setChosen(true);
    setFieldErrors({});
    // their own link wins over the match's cover
    if (!ownCover) setImage(hit.cover);
    if (!formatTouched.current) setLightNovel(hit.lightNovel);
    // the match's genre, or none: never one left from an earlier match
    if (!genreTouched.current) {
      setGenre(hit.genre ?? "");
      setGenreFromAniList(Boolean(hit.genre));
    }
  };
  // looked up while they search, and for the price checker's title until
  // its match is picked; not once the rest of the form is open
  const searching = !chosen || (!picked && title === fromPrices);
  const search = useCoverSearch(searching ? title : "", {
    perPage: MATCHES,
    // the price checker's title: its own match, picked for them
    onFound: (hits, query) => {
      if (!autoPick.current || query !== fromPrices.trim()) return;
      const same = hits.find(
        (h) => h.title.toLowerCase() === query.toLowerCase(),
      );
      if (same) pickTitle(same);
    },
  });

  // signed-out visitors go to sign in, then come back here. null means the
  // server hasn't answered yet, so wait rather than bounce a signed-in user
  useEffect(() => {
    if (isSignedIn === false) {
      navigate(signInPath(`/add?${searchParams}`), { replace: true });
    }
  }, [isSignedIn, navigate, searchParams]);

  const asTyped = () => {
    autoPick.current = false;
    // an earlier match's type doesn't carry over to a title it isn't
    if (!formatTouched.current) setLightNovel(novelFromPrices);
    setPicked(null);
    if (!genreTouched.current) {
      setGenre("");
      setGenreFromAniList(false);
    }
    setChosen(true);
    setFieldErrors({});
    if (!ownCover) setImage("");
  };
  // back to the search, with what they had in the box
  const change = () => {
    autoPick.current = false;
    setChosen(false);
    setPicked(null);
    requestAnimationFrame(() => document.getElementById("name")?.focus());
  };
  const closeOwnCover = () => {
    setOwnCover(false);
    setImage(picked?.cover ?? "");
    setFieldErrors((e) => ({ ...e, image: undefined }));
  };

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError([]);
    const form = new FormData(e.currentTarget);
    const missing = {
      title: !title.trim() ? "Give it a title." : undefined,
      // optional: a collector tracking volumes needn't say a chapter
      bookmark:
        stage === "reading" && tracks.chapters
          ? chapterProblem(chapter)
          : undefined,
      image: ownCover ? coverLinkProblem(image) : undefined,
    };
    setFieldErrors(missing);
    if (missing.title) {
      change();
      return;
    }
    const first = missing.bookmark
      ? "bookmark"
      : missing.image
        ? "cover-link"
        : null;
    if (first) {
      const field = document.getElementById(first);
      field?.scrollIntoView({ block: "center" });
      field?.focus({ preventScroll: true });
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
    sendReq.byVolume = byVolume;
    if (stage === "reading" && tracks.chapters) sendReq.bookmark = chapter;
    if (stage === "reading" && tracks.volumes) sendReq.readVolume = readVolume;
    // stars only for something they've read some of
    if (stage !== "planned" && rating) sendReq.rating = rating;

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

  const genreName = GENRES.find((g) => g.value === genre)?.label;
  const meta = [
    lightNovel ? "Light novel" : "Manga",
    picked?.year,
    genreName,
  ].filter(Boolean);
  const coverShows = Boolean(image) && brokenCover !== image;

  return (
    <div className={`${styles.addPage} fade-in`}>
      <form
        className={`${styles.addSheet} ${styles.sheetCaptioned}`}
        onSubmit={handleFormSubmit}
        noValidate
      >
        {/* the page's title set into the box's top edge, like a manga
            panel's caption, with the way back in the other corner: one row
            instead of a header above the form */}
        <div className={styles.caption}>
          <h1 className={styles.captionTitle}>New entry</h1>
          <NavLink
            to="/shelf"
            className={styles.captionBack}
            aria-label="Back to the shelf"
            viewTransition
          >
            <ChevronLeftIcon aria-hidden />
            Shelf
          </NavLink>
        </div>

        {!chosen ? (
          <div className={styles.field} data-tour="add-title">
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
              hits={search.query === title.trim() ? search.hits : []}
              status={search.status}
              onPick={pickTitle}
              onTyped={asTyped}
              isAddPage
            />
            {fieldErrors.title ? (
              <p id="name-error" className={styles.fieldError}>
                {fieldErrors.title}
              </p>
            ) : typedIsbn ? (
              // a barcode's number, not a name: the scanner knows what it is
              <p className={styles.alreadyNote} role="status">
                That's an ISBN.{" "}
                <NavLink
                  to={`/shelf?scan=${typedIsbn}`}
                  className={styles.textLink}
                >
                  Add the book it belongs to
                </NavLink>
              </p>
            ) : (
              <p className={styles.hint}>
                Pick it from the list and the cover, type and genre come with
                it.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className={styles.picked} data-tour="add-title">
              {coverShows ? (
                <span className={styles.pickedCover}>
                  <img
                    src={image}
                    alt=""
                    onError={() => setBrokenCover(image)}
                  />
                </span>
              ) : (
                <span className={styles.pickedBlank}>
                  {image ? "link not loading" : "no cover"}
                </span>
              )}
              <div className="min-w-0">
                <h2 className={styles.pickedName}>{title}</h2>
                <p className={styles.pickedMeta}>
                  {picked ? meta.join(" · ") : "As you typed it"}
                </p>
                <div className={styles.pickedActs}>
                  <button
                    type="button"
                    className={styles.textLink}
                    onClick={change}
                  >
                    Change
                  </button>
                  {!ownCover && (
                    <button
                      type="button"
                      className={styles.textLink}
                      onClick={() => {
                        setOwnCover(true);
                        setImage("");
                        requestAnimationFrame(() =>
                          document.getElementById("cover-link")?.focus(),
                        );
                      }}
                    >
                      <LinkIcon />
                      {picked ? "Use my own cover" : "Add a cover image"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {already?.title === title && (
              <p className={styles.alreadyNote} role="status">
                Already on your shelf as <b>{already.match.name}</b>.{" "}
                <NavLink
                  to={`/details/${already.match.id}`}
                  className={styles.textLink}
                  viewTransition
                >
                  Open it
                </NavLink>
              </p>
            )}

            {ownCover && (
              <div className={styles.field}>
                <label htmlFor="cover-link" className={styles.label}>
                  Your own cover{" "}
                  <span className={styles.optional}>· an image link</span>
                </label>
                <div className={styles.linkRow}>
                  <input
                    className={`${styles.input} ${fieldErrors.image ? styles.invalid : ""}`}
                    type="url"
                    id="cover-link"
                    name="image"
                    placeholder="https://…"
                    value={image}
                    onChange={(e) => {
                      setImage(e.target.value.trim());
                      setFieldErrors((er) => ({ ...er, image: undefined }));
                    }}
                    aria-invalid={Boolean(fieldErrors.image) || undefined}
                    aria-describedby={
                      fieldErrors.image ? "cover-link-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    className={styles.textLink}
                    onClick={closeOwnCover}
                  >
                    {picked ? "Use theirs" : "Remove link"}
                  </button>
                </div>
                {fieldErrors.image && (
                  <p id="cover-link-error" className={styles.fieldError}>
                    {fieldErrors.image}
                  </p>
                )}
              </div>
            )}

            {/* the chapter, when it's asked for, beside the choice that
                asks for it (under it on phones) */}
            <div
              className={
                stage === "reading" ? styles.statusRow : styles.statusAlone
              }
            >
              <StatusField
                stage={stage}
                onChange={(next) => {
                  setStage(next);
                  // a chapter it asked for may not be asked for now
                  setFieldErrors((e) => ({ ...e, bookmark: undefined }));
                }}
                required
              />
              {stage === "reading" && (
                <PlaceField
                  mode={trackBy}
                  byVolume={byVolume}
                  onByVolume={setByVolumeChoice}
                  chapter={chapter}
                  onChapter={(next) => {
                    setChapter(next);
                    setFieldErrors((er) => ({ ...er, bookmark: undefined }));
                  }}
                  volume={readVolume}
                  onVolume={setReadVolume}
                  chapterError={fieldErrors.bookmark}
                  optional
                  classes={{ ...styles, field: styles.chapterField }}
                />
              )}
            </div>

            {/* stars for something they've read some of; tap again to clear */}
            {stage !== "planned" && (
              <div className={styles.field}>
                <span className={styles.label} id="add-rating">
                  Your rating{" "}
                  <span className={styles.optional}>(optional)</span>
                </span>
                <span className="inline-block w-fit">
                  <StarRating
                    value={rating}
                    onChange={(stars) =>
                      setRating(stars === rating ? 0 : stars)
                    }
                  />
                </span>
              </div>
            )}

            <details
              className={styles.more}
              open={moreOpen}
              onToggle={(e) => {
                const open = e.currentTarget.open;
                setMoreOpen(open);
                localStorage.setItem(MORE_KEY, open ? "1" : "0");
              }}
            >
              <summary className={styles.moreSummary}>
                <span className={styles.moreTitle}>More about it</span>
                <span className={styles.moreSub}>
                  Volumes, notes, type, genre
                </span>
                <span className={styles.moreArrow} aria-hidden>
                  <ChevronDownIcon />
                </span>
              </summary>
              <div className={styles.moreBody}>
                {volumes.field}
                <div className={styles.row}>
                  <FormatField
                    lightNovel={lightNovel}
                    onChange={(value) => {
                      formatTouched.current = true;
                      setLightNovel(value);
                    }}
                  />
                  <div className={styles.field}>
                    <label htmlFor="genre" className={styles.label}>
                      Genre{" "}
                      {genreFromAniList && (
                        <span className={styles.optional}>(from AniList)</span>
                      )}
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
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label htmlFor="description" className={styles.label}>
                      Notes
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
              </div>
            </details>

            {validationError.length != 0 && (
              <ul className={styles.errorList} role="alert">
                {validationError.map((e) => (
                  <li key={e.msg}>{e.msg}</li>
                ))}
              </ul>
            )}

            <div className={styles.addActions}>
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
          </>
        )}
      </form>
    </div>
  );
}

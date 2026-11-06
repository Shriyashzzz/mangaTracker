import { useEffect, useRef, useState } from "react";
import { searchCovers, type CoverHit } from "../../lib/anilist";
import clsx from "clsx";

// the other matches, small enough to sit under the cover; a sideways
// strip on phones
const grid =
  "grid grid-cols-4 gap-[0.35rem] transition-opacity duration-200 ease-[ease] upto-760:col-start-2 upto-760:row-start-3 upto-760:auto-cols-[58px] upto-760:grid-flow-col upto-760:grid-cols-none upto-760:content-start upto-760:overflow-x-auto upto-760:pb-1 upto-760:[scrollbar-color:var(--line-soft)_transparent] upto-760:[scrollbar-width:thin]";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 450;

// the cover column of the add / edit forms: shows the chosen cover big,
// looks the title up on AniList for alternatives, and takes a pasted link.
// `value` is the chosen image URL, and onChange also gets the AniList
// match (null for a pasted link)
type Props = {
  title: string;
  value: string;
  onChange: (url: string, match: CoverHit | null) => void;
  // don't choose a cover on their behalf: they've already picked this manga
  coverChosen?: boolean;
  // shown big for now in place of `value`, without choosing it
  previewUrl?: string | null;
  // everything AniList found, and for which title
  onResults?: (found: CoverHit[], query: string) => void;
  className?: string;
  // what's wrong with a pasted link, said under the box
  error?: string;
};

type Status = "idle" | "loading" | "done" | "error";

export default function CoverPicker({
  title,
  value,
  onChange,
  coverChosen = false,
  previewUrl = null,
  onResults,
  className = "",
  error,
}: Props) {
  const [results, setResults] = useState<CoverHit[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  // once the user picks or pastes something we stop auto-choosing for them
  const touched = useRef(Boolean(value));

  const query = title.trim();
  const tooShort = query.length < MIN_QUERY;

  useEffect(() => {
    if (tooShort) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const found = await searchCovers(query, controller.signal);
        setResults(found);
        setStatus("done");
        onResults?.(found, query);
        if (!touched.current && !coverChosen && found.length) {
          onChange(found[0]!.cover, found[0]!);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // onChange is a setter from the parent, it doesn't need to retrigger the search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tooShort]);

  // a cleared title hides old results without another round trip
  const shownStatus = tooShort ? "idle" : status;
  const shown = tooShort ? [] : results;
  const bigCover = previewUrl || value;
  const broken = Boolean(bigCover) && brokenUrl === bigCover;

  const pick = (url: string, match: CoverHit | null = null) => {
    touched.current = true;
    onChange(url, match);
  };
  // the link box holds a link they pasted (or are typing), never the address
  // of a cover picked from AniList or saved from a list import. Worked out
  // from the cover itself, so it follows any change made from outside
  const pasted =
    Boolean(value) &&
    !results.some((r) => r.cover === value) &&
    !/anilist\.co|myanimelist|kitsu/i.test(value);

  const hasImage = Boolean(bigCover) && !broken;

  return (
    // a column beside the form on laptops; on phones a small cover sits
    // beside the matches, with the label above and the link field below
    <div
      className={clsx(
        "flex min-w-0 flex-col gap-[0.6rem] upto-760:grid upto-760:grid-cols-[96px_minmax(0,1fr)] upto-760:grid-rows-[auto_auto_1fr_auto] upto-760:gap-x-[0.8rem]",
        className,
      )}
    >
      <span
        className="text-[0.9rem] font-semibold upto-760:col-span-2"
        id="cover-label"
      >
        Cover{" "}
        <span className="text-[0.82rem] font-normal text-muted">
          (optional)
        </span>
      </span>

      {/* the chosen cover, as it'll sit on the shelf. Its height follows the
          viewport so the whole add form fits on short laptop screens too */}
      <div
        className={clsx(
          "mx-auto grid aspect-2/3 h-[clamp(150px,calc(100dvh-470px),258px)] max-w-full place-items-center bg-paper upto-760:col-start-1 upto-760:row-span-2 upto-760:row-start-2 upto-760:h-auto upto-760:w-full",
          hasImage
            ? "border-[1.5px] border-line p-0"
            : "border-[1.5px] border-dashed border-line-soft p-4 upto-760:p-2",
        )}
      >
        {hasImage ? (
          <img
            src={bigCover}
            alt=""
            className="size-full object-cover"
            onError={() => setBrokenUrl(bigCover)}
          />
        ) : (
          <span className="text-center font-hand text-[1.2rem] leading-[1.2] text-muted upto-760:text-[0.95rem]">
            {broken
              ? "hm, that link isn't loading as an image"
              : "type a title and a cover shows up here"}
          </span>
        )}
      </div>

      <span
        className="min-h-[1em] font-mono text-[0.7rem] leading-[1.3] text-muted empty:hidden upto-760:col-start-2 upto-760:row-start-2 [&_a]:text-ink-soft [&_a]:underline [&_a]:underline-offset-2"
        aria-live="polite"
      >
        {shownStatus === "loading" && "Looking it up…"}
        {shownStatus === "done" &&
          (shown.length ? (
            <>
              Matches from{" "}
              <a href="https://anilist.co" target="_blank" rel="noreferrer">
                AniList
              </a>
            </>
          ) : (
            "No covers found for that title"
          ))}
        {shownStatus === "error" &&
          "Couldn't reach AniList, paste a link instead"}
      </span>

      {shownStatus === "loading" && shown.length === 0 && (
        <div className={grid} aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="skeleton block aspect-2/3 w-full" />
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <div
          className={clsx(grid, shownStatus === "loading" && "opacity-50")}
          role="radiogroup"
          aria-labelledby="cover-label"
        >
          {shown.map((r) => {
            const selected = value === r.cover;
            const label =
              (r.year ? `${r.title} (${r.year})` : r.title) +
              (r.lightNovel ? ", light novel" : "");
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                // chosen match gets a red frame and a corner tick
                className={clsx(
                  "group/thumb relative block cursor-pointer focus-visible:outline-none",
                  selected && "tick-corner",
                )}
                onClick={() => (selected ? pick("") : pick(r.cover, r))}
              >
                <img
                  src={r.cover}
                  alt=""
                  loading="lazy"
                  className={clsx(
                    "block aspect-2/3 w-full bg-paper-2 object-cover transition-[border-color,translate] duration-200 ease-ink group-hover/thumb:-translate-y-0.5 group-hover/thumb:border-line group-focus-visible/thumb:outline-2 group-focus-visible/thumb:outline-offset-2 group-focus-visible/thumb:outline-accent group-focus-visible/thumb:outline-dashed",
                    selected
                      ? "border-[2.5px] border-accent group-hover/thumb:border-accent"
                      : "border-[1.5px] border-line-soft",
                  )}
                />
              </button>
            );
          })}
        </div>
      )}

      {value && (
        <button
          type="button"
          className="tap self-start text-[0.8rem] text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current upto-760:col-span-2"
          onClick={() => pick("")}
        >
          No cover
        </button>
      )}

      <label className="upto-760:col-span-2">
        <span className="sr-only">Cover image link</span>
        <input
          type="url"
          id="cover-link"
          name="image"
          placeholder="or paste an image link"
          value={pasted ? value : ""}
          onChange={(e) => pick(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "cover-link-error" : undefined}
          className="h-11 w-full rounded-[2px] border-[1.5px] border-line-soft bg-paper px-[0.6rem] text-[0.8rem] upto-760:text-[1rem] transition-[border-color,box-shadow] duration-120 ease-[ease] placeholder:text-muted placeholder:opacity-85 focus:border-line focus:shadow-[3px_3px_0_var(--accent)] focus:outline-none"
        />
      </label>
      {error && (
        <p
          id="cover-link-error"
          className="text-[0.85rem] font-medium text-accent upto-760:col-span-2"
        >
          {error}
        </p>
      )}
    </div>
  );
}

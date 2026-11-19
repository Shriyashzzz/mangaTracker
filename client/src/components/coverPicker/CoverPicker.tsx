import { useRef, useState } from "react";
import type { CoverHit } from "../../lib/anilist";
import clsx from "clsx";
import { useCoverSearch } from "./useCoverSearch";
import { coverSrc } from "../../lib/prices";
import { isVolumeCover } from "../../lib/coverSizes";

// The covers to pick from, small enough to sit under the big one; a sideways
// strip on phones. One strip for all of them: their own books' covers first
// (each tagged "yours"), then AniList's matches. Two strips, each with its
// own heading, took twice the room on a phone for a book or two
const grid =
  "grid grid-cols-4 gap-[0.35rem] transition-opacity duration-200 ease-[ease] upto-760:col-start-2 upto-760:row-start-3 upto-760:auto-cols-[58px] upto-760:grid-flow-col upto-760:grid-cols-none upto-760:content-start upto-760:overflow-x-auto upto-760:pb-1 upto-760:[scrollbar-color:var(--line-soft)_transparent] upto-760:[scrollbar-width:thin]";
// the tag across the foot of a cover that's from a book they own
const yoursTag =
  "pointer-events-none absolute inset-x-0 bottom-0 bg-ink py-[1px] text-center font-mono text-[0.6rem] leading-[1.4] tracking-[0.04em] text-paper uppercase";

// a cover of a book they own: the address the shelf saves, and its name
export type OwnCover = { url: string; name: string };

const thumbClass = (selected: boolean) =>
  clsx(
    "block aspect-2/3 w-full bg-paper-2 object-cover transition-[border-color,translate] duration-200 ease-ink group-hover/thumb:-translate-y-0.5 group-hover/thumb:border-line group-focus-visible/thumb:outline-2 group-focus-visible/thumb:outline-offset-2 group-focus-visible/thumb:outline-accent group-focus-visible/thumb:outline-dashed",
    selected
      ? "border-[2.5px] border-accent group-hover/thumb:border-accent"
      : "border-[1.5px] border-line-soft",
  );

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
  // covers of the books they own of this series, one per edition, offered
  // above AniList's matches. Only ever their own books': an edition's cover
  // isn't offered to someone who doesn't own a book of it
  ownCovers?: OwnCover[];
};

export default function CoverPicker({
  title,
  value,
  onChange,
  coverChosen = false,
  previewUrl = null,
  onResults,
  className = "",
  error,
  ownCovers = [],
}: Props) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  // once the user picks or pastes something we stop auto-choosing for them
  const touched = useRef(Boolean(value));
  const search = useCoverSearch(title, {
    onFound: (found, query) => {
      onResults?.(found, query);
      if (!touched.current && !coverChosen && found.length) {
        onChange(found[0]!.cover, found[0]!);
      }
    },
  });
  const shownStatus = search.status;
  const shown = search.hits;
  const results = shown;
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
    !isVolumeCover(value) &&
    !/anilist\.co|myanimelist|kitsu/i.test(value);
  const pickedOwn = ownCovers.find((c) => c.url === value);
  const hasOwn = ownCovers.length > 0;
  const searching = shownStatus === "loading" && shown.length === 0;

  const hasImage = Boolean(bigCover) && !broken;

  return (
    // a column beside the form on laptops; on phones a small cover sits
    // beside the matches and the link field, which sit at the top of that
    // column (the last row takes any spare height), with the label above
    <div
      className={clsx(
        "flex min-w-0 flex-col gap-[0.6rem] upto-760:grid upto-760:grid-cols-[96px_minmax(0,1fr)] upto-760:grid-rows-[auto_auto_auto_1fr] upto-760:gap-x-[0.8rem]",
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
          "mx-auto grid aspect-2/3 h-[clamp(150px,calc(100dvh-470px),258px)] max-w-full place-items-center bg-paper upto-760:col-start-1 upto-760:row-span-3 upto-760:row-start-2 upto-760:h-auto upto-760:w-full",
          hasImage
            ? "border-[1.5px] border-line p-0"
            : "border-[1.5px] border-dashed border-line-soft p-4 upto-760:p-2",
        )}
      >
        {hasImage ? (
          <img
            src={coverSrc(bigCover)}
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

      {/* what the strip under it holds, and on the same line the way back to
          no cover at all */}
      <div className="flex min-h-[1em] items-baseline justify-between gap-2 upto-760:col-start-2 upto-760:row-start-2">
        <span
          className="font-mono text-[0.7rem] leading-[1.3] text-muted [&_a]:text-ink-soft [&_a]:underline [&_a]:underline-offset-2"
          aria-live="polite"
        >
          {/* which book the picked one is: the thumbnails are small */}
          {pickedOwn ? (
            <span className="text-ink-soft">{pickedOwn.name}, your book</span>
          ) : (
            <>
              {shownStatus === "loading" && "Looking it up…"}
              {shownStatus === "done" &&
                (shown.length ? (
                  <>
                    Matches from{" "}
                    <a
                      href="https://anilist.co"
                      target="_blank"
                      rel="noreferrer"
                    >
                      AniList
                    </a>
                  </>
                ) : hasOwn ? (
                  "From books you own"
                ) : (
                  "No covers found for that title"
                ))}
              {shownStatus === "error" &&
                "Couldn't reach AniList, paste a link instead"}
              {shownStatus === "idle" && hasOwn && "From books you own"}
            </>
          )}
        </span>
        {value && (
          <button
            type="button"
            className="tap shrink-0 text-[0.8rem] text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current"
            onClick={() => pick("")}
          >
            No cover
          </button>
        )}
      </div>

      {(hasOwn || shown.length > 0 || searching) && (
        <div className={grid} role="radiogroup" aria-labelledby="cover-label">
          {ownCovers.map((own) => {
            const selected = value === own.url;
            return (
              <button
                key={own.url}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${own.name}, your book`}
                title={own.name}
                className={clsx(
                  "group/thumb relative block cursor-pointer focus-visible:outline-none",
                  selected && "tick-corner",
                )}
                onClick={() => (selected ? pick("") : pick(own.url))}
              >
                <img
                  src={coverSrc(own.url)}
                  alt=""
                  loading="lazy"
                  className={thumbClass(selected)}
                />
                <span className={yoursTag} aria-hidden>
                  yours
                </span>
              </button>
            );
          })}
          {searching &&
            Array.from({ length: 3 }, (_, i) => (
              <span
                key={i}
                className="skeleton block aspect-2/3 w-full"
                aria-hidden
              />
            ))}
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
                  shownStatus === "loading" && "opacity-50",
                )}
                onClick={() => (selected ? pick("") : pick(r.cover, r))}
              >
                <img
                  src={r.cover}
                  alt=""
                  loading="lazy"
                  className={thumbClass(selected)}
                />
              </button>
            );
          })}
        </div>
      )}

      <label className="upto-760:col-start-2 upto-760:row-start-4 upto-760:self-start">
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

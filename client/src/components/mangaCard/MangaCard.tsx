import { useState } from "react";
import { NavLink } from "react-router";
import StarRating from "../starRating/StarRating";
import DrawnCover from "../drawnCover/DrawnCover";
import type { Manga } from "../../lib/types";
import { ownedOf, rangesText } from "../../lib/ownedVolumes";

// what's come out for it on the New tab
export type CardNews = {
  text: string;
  // where they've got to, right under it
  yours?: string;
  // a backlog step ("Vol. 11 next"), not news: in ink, so red means just out
  waiting?: boolean;
};

type Props = {
  currentManga: Manga;
  news?: CardNews;
  // added to the card's link, e.g. to open the details in the Japan view
  detailsSearch?: string;
  // somewhere else for the card to lead instead of its details page
  linkTo?: string;
  // opens something in place, rather than following the link
  onOpen?: () => void;
  // position on the shelf, for the staggered entrance
  index?: number;
  // a row with a small cover at every screen size, chosen in settings
  compact?: boolean;
  // how far through the series they are, once we know the latest chapter
  latestChapter?: number | null;
  // the shelf's Select: the card ticks instead of opening
  select?: { checked: boolean; onToggle: () => void };
};

// every card leans a little differently when you hover it: the 1st, 2nd and
// 3rd of each three tilt their own way. Ticked in Select, it's ringed in red
const coverBase =
  "relative aspect-2/3 rounded-[2px] border-[1.5px] border-line bg-paper-2 transition-[translate,rotate,box-shadow] duration-180 ease-[ease] group-hover:-translate-x-0.5 group-hover:-translate-y-[3px] group-hover:-rotate-1 group-hover:shadow-[6px_7px_0_var(--hard-shadow)] [.group:nth-child(3n+2):hover_&]:rotate-[0.8deg] [.group:nth-child(3n):hover_&]:-rotate-[0.4deg] [[data-picked]_&]:outline-3 [[data-picked]_&]:outline-offset-2 [[data-picked]_&]:outline-accent";

export default function MangaCard({
  currentManga,
  news,
  detailsSearch = "",
  linkTo,
  onOpen,
  index = 0,
  compact = false,
  latestChapter,
  select,
}: Props) {
  // a cover that wouldn't load, so the drawn one shows instead
  const [brokenImage, setBrokenImage] = useState<string | null>(null);
  const asColumns = compact && !news;
  // a count that's behind where they are says nothing, so it isn't shown
  const reading = currentManga.bookmark ?? 0;
  const knownTotal =
    latestChapter != null && latestChapter >= reading ? latestChapter : null;
  // a collector of the books, no chapter kept: what they own says where
  // they are ("vols. 1–10"), never "not started"
  const owned = ownedOf(currentManga);
  const ownedText = owned.length
    ? `${owned.length === 1 ? "vol." : "vols."} ${rangesText(owned)}`
    : null;
  const genre =
    currentManga.genre && currentManga.genre !== "unlabled"
      ? currentManga.genre
      : null;

  const rootClass = asColumns
    ? "group grid animate-card-in grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-x-3 py-1.5"
    : compact
      ? "group flex animate-card-in flex-row items-start gap-3 py-1.5"
      : news
        ? "group flex animate-card-in flex-col gap-[0.7rem] upto-720:flex-row upto-720:items-center upto-720:gap-3 upto-720:py-1.5"
        : "group flex animate-card-in flex-col gap-[0.7rem]";
  const delay = { animationDelay: `${Math.min(index, 12) * 35}ms` };

  const body = (
    <>
      <div
        className={
          compact
            ? `${coverBase} w-11 shrink-0 shadow-ink`
            : news
              ? `${coverBase} shadow-ink-lg upto-720:w-11 upto-720:shrink-0 upto-720:shadow-ink`
              : `${coverBase} shadow-ink-lg`
        }
      >
        {currentManga.image && brokenImage !== currentManga.image ? (
          <img
            src={currentManga.image}
            alt=""
            loading="lazy"
            // out of the flow, or a tall image stretches the cover past its shape
            className="absolute inset-0 size-full object-cover"
            onError={() => setBrokenImage(currentManga.image)}
          />
        ) : (
          // no cover, or one that won't load: its name, lettered on
          <DrawnCover title={currentManga.name} />
        )}
        {select && (
          <span className="absolute top-1 left-1 z-1 grid place-items-center rounded-[3px] border-[1.5px] border-line bg-card p-[3px] shadow-ink">
            <input
              type="checkbox"
              className="size-5 cursor-pointer accent-accent"
              checked={select.checked}
              onChange={select.onToggle}
              aria-label={`Select ${currentManga.name}`}
            />
          </span>
        )}
        {/* hanko-style stamp for finished series */}
        {currentManga.status && !compact && (
          <span
            className={`absolute top-2.5 right-2 rotate-8 rounded-[3px] border-2 border-accent-hover bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-2 py-[0.15rem] font-brand text-[1rem] leading-[1.2] tracking-[1.5px] text-accent-hover${news ? " upto-720:hidden" : ""}`}
          >
            Done
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-[0.15rem]">
        <p
          className={`${compact ? "line-clamp-1" : news ? "line-clamp-2 min-h-[2.5em] upto-720:min-h-0 upto-720:line-clamp-1" : "line-clamp-2"}  font-display text-[1.05rem] leading-[1.25] font-semibold decoration-accent underline-offset-3 group-hover:underline`}
        >
          {currentManga.name}
        </p>
        {/* a row gives the chapter its own line: it's what they came to see */}
        {compact && !news ? (
          <>
            <p className="truncate font-mono text-[0.85rem] font-medium text-ink-soft">
              {/* the right side already says when it's finished */}
              {currentManga.planned
                ? "to read"
                : currentManga.bookmark
                  ? `ch. ${currentManga.bookmark}`
                  : ownedText
                    ? ownedText
                    : currentManga.status
                      ? "no chapter saved"
                      : "not started"}
            </p>
            {/* one line for the rest, so every row is the same height */}
            <div className="flex min-h-[1.2rem] min-w-0 items-center gap-3">
              {(genre || currentManga.lightNovel) && (
                <p className="truncate font-mono text-[0.78rem] text-muted">
                  {[currentManga.lightNovel && "light novel", genre]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </>
        ) : (
          <p
            className={`min-h-[1.5em] truncate font-mono text-[0.78rem] text-muted${
              news ? (compact ? " hidden" : " upto-720:hidden") : ""
            }`}
          >
            {news
              ? genre
              : // a blank or zero chapter says nothing worth showing
                [
                  currentManga.status
                    ? "finished"
                    : currentManga.planned
                      ? "to read"
                      : currentManga.bookmark
                        ? `ch. ${currentManga.bookmark}`
                        : ownedText,
                  currentManga.lightNovel && "light novel",
                  genre,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        )}
        {news && (
          <p
            className={`font-brand text-[1.05rem] tracking-[1px] ${news.waiting ? "text-ink-soft" : "text-accent"}`}
          >
            {news.text}
          </p>
        )}
        {news && (
          <p className="min-h-[1.3em] text-[0.82rem] leading-[1.3] text-ink-soft">
            {news.yours}
          </p>
        )}
        {/* the New tab's cards all match: only what's out and where they are */}
        {/* a fixed slot, rated or not, so a row of covers lines up */}
        {!news && !compact && (
          <span className="block min-h-4">
            {Number(currentManga.rating) > 0 && (
              <StarRating value={Number(currentManga.rating)} size="sm" />
            )}
          </span>
        )}
      </div>
      {asColumns && (
        <span className="flex items-center gap-12 upto-720:gap-6">
          <span className="flex items-center upto-720:hidden">
            {/* unrated ones show empty stars, so the column always reads the same */}
            <StarRating value={Number(currentManga.rating) || 0} size="sm" />
          </span>
          <span className="flex w-28 flex-col justify-center gap-1 pr-3 text-right font-mono text-[0.82rem] text-ink-soft upto-720:w-[5.5rem] upto-720:pr-2">
            {currentManga.status ? (
              "Finished"
            ) : !reading && owned.length ? (
              // no chapter kept: how many books, not "0 of 143"
              <span className="whitespace-nowrap">
                {owned.length} {owned.length === 1 ? "vol" : "vols"}
              </span>
            ) : knownTotal != null && reading > 0 ? (
              <>
                <span className="whitespace-nowrap">
                  {reading} of {knownTotal}
                </span>
                <span
                  className="block h-1.5 overflow-hidden rounded-full border border-line bg-card"
                  aria-hidden
                >
                  <span
                    className="block h-full bg-accent"
                    style={{
                      width: `${knownTotal ? Math.min((reading / knownTotal) * 100, 100) : 0}%`,
                    }}
                  />
                </span>
              </>
            ) : null}
          </span>
        </span>
      )}
    </>
  );

  // a label, so the whole card ticks its box; the box sits on the cover
  if (select)
    return (
      <label
        data-tour="card"
        className={`${rootClass} cursor-pointer`}
        style={delay}
        data-picked={select.checked || undefined}
      >
        {body}
      </label>
    );

  return (
    <NavLink
      data-tour="card"
      to={linkTo ?? `/details/${currentManga.id}${detailsSearch}`}
      className={rootClass}
      style={delay}
      viewTransition
      // says where it came from, so the page it opens can lead back
      state={linkTo ? { fromShelf: true } : undefined}
      {...(onOpen && {
        "aria-haspopup": "dialog" as const,
        onClick: (e) => {
          e.preventDefault();
          onOpen();
        },
      })}
    >
      {body}
    </NavLink>
  );
}

export function MangaCardSkeleton() {
  return (
    <div className="flex flex-col gap-[0.6rem]" aria-hidden>
      <div className="skeleton aspect-2/3" />
      <div className="skeleton h-3.5 w-4/5" />
      <div className="skeleton h-[11px] w-[45%]" />
    </div>
  );
}

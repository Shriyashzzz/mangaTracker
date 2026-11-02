import { NavLink } from "react-router";
import StarRating from "../starRating/StarRating";
import { FALLBACK_COVER } from "../../lib/api";
import { formatCents } from "../../lib/prices";
import type { Manga, ShelfPrice } from "../../lib/types";

// what's come out for it on the New tab
export type CardNews = {
  text: string;
  // where they've got to, right under it
  yours?: string;
};

// priceTag: the cheapest price we've seen for the series, if any
type Props = {
  currentManga: Manga;
  priceTag?: ShelfPrice;
  news?: CardNews;
  // added to the card's link, e.g. to open the details in the Japan view
  detailsSearch?: string;
  // somewhere else for the card to lead instead of its details page
  linkTo?: string;
  // opens something in place, rather than following the link
  onOpen?: () => void;
  // position on the shelf, for the staggered entrance
  index?: number;
};

// every card leans a little differently when you hover it: the 1st, 2nd and
// 3rd of each three tilt their own way
const cover =
  "relative aspect-2/3 rounded-[2px] border-[1.5px] border-line bg-paper-2 shadow-ink-lg transition-[translate,rotate,box-shadow] duration-180 ease-[ease] group-hover:-translate-x-0.5 group-hover:-translate-y-[3px] group-hover:-rotate-1 group-hover:shadow-[6px_7px_0_var(--hard-shadow)] [.group:nth-child(3n+2):hover_&]:rotate-[0.8deg] [.group:nth-child(3n):hover_&]:-rotate-[0.4deg]";

export default function MangaCard({
  currentManga,
  priceTag,
  news,
  detailsSearch = "",
  linkTo,
  onOpen,
  index = 0,
}: Props) {
  const genre =
    currentManga.genre && currentManga.genre !== "unlabled"
      ? currentManga.genre
      : null;

  return (
    <NavLink
      to={linkTo ?? `/details/${currentManga.id}${detailsSearch}`}
      className="group flex animate-card-in flex-col gap-[0.7rem]"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      viewTransition
      {...(onOpen && {
        "aria-haspopup": "dialog" as const,
        onClick: (e) => {
          e.preventDefault();
          onOpen();
        },
      })}
    >
      <div className={cover}>
        <img
          src={currentManga.image || FALLBACK_COVER}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_COVER) {
              e.currentTarget.src = FALLBACK_COVER;
            }
          }}
        />
        {/* hanko-style stamp for finished series */}
        {currentManga.status && (
          <span className="absolute top-2.5 right-2 rotate-8 rounded-[3px] border-2 border-accent bg-[color-mix(in_srgb,var(--card)_85%,transparent)] px-2 py-[0.15rem] font-brand text-[1rem] leading-[1.2] tracking-[1.5px] text-accent">
            Done
          </span>
        )}
      </div>
      <div className="flex flex-col gap-[0.15rem]">
        <p className="line-clamp-2 font-display text-[1.05rem] leading-[1.25] font-semibold decoration-accent underline-offset-3 group-hover:underline">
          {currentManga.name}
        </p>
        <p className="truncate font-mono text-[0.78rem] text-muted">
          {news ? (
            genre
          ) : (
            <>
              {currentManga.status ? "finished" : `ch. ${currentManga.bookmark}`}
              {genre && <span> · {genre}</span>}
            </>
          )}
        </p>
        {news && (
          <p className="font-brand text-[1.05rem] tracking-[1px] text-accent">
            {news.text}
          </p>
        )}
        {news?.yours && (
          <p className="text-[0.82rem] leading-[1.3] text-ink-soft">
            {news.yours}
          </p>
        )}
        {priceTag && (
          <p
            // the lowest price we've seen for the series at the stores we
            // check (not every store), quiet until you look
            className="font-mono text-[0.78rem] text-muted"
            title={`At the stores we check: ${priceTag.title}`}
          >
            lowest seen{" "}
            <span className="font-medium text-accent">
              {formatCents(priceTag.fromCents)}
            </span>
          </p>
        )}
        {Number(currentManga.rating) > 0 && (
          <StarRating value={Number(currentManga.rating)} size="sm" />
        )}
      </div>
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

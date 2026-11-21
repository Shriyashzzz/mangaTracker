import { useLongPress } from "../../lib/useLongPress";
import {
  placeText as placeOf,
  tracksOf,
  type TrackBy,
} from "../../lib/reading";
import { useTrackBy } from "../../lib/prefs";
import { NavLink } from "react-router";
import SeriesPicture from "../cover/SeriesPicture";
import KeepRanges from "../keepRanges/KeepRanges";
import StarRating from "../starRating/StarRating";
import type { Manga } from "../../lib/types";
import { ownedOf } from "../../lib/ownedVolumes";
import {
  coverLine,
  genreOf,
  ownedTextOf,
  progressOf,
  rowKindLine,
} from "./cardText";

// what's come out for it on the New tab
export type CardNews = {
  text: string;
  // cut short for a phone's row and a compact row ("Def. 3 next"); the
  // whole of it stays for screen readers and hover
  short?: string;
  // where they've got to, right under it
  yours?: string;
  // "2 volumes behind", when they are: said under it, and the card goes
  // grey (a step through a backlog, not the newest volume)
  behind?: string;
};

type Props = {
  currentManga: Manga;
  news?: CardNews;
  // added to the card's link, e.g. to open the details in the Japan view
  detailsSearch?: string;
  // New's In Japan side: the Japanese cover, since that edition is what
  // the card is about
  japanFirst?: boolean;
  // somewhere else for the card to lead instead of its details page
  linkTo?: string;
  // opens something in place, rather than following the link
  onOpen?: () => void;
  // a long press in the app (lib/useLongPress.ts): the shelf starts
  // selecting with this one picked
  onLongPress?: () => void;
  // position on the shelf, for the staggered entrance
  index?: number;
  // a row with a small cover at every screen size, chosen in settings
  compact?: boolean;
  // how far through the series they are, once we know the latest chapter
  latestChapter?: number | null;
  // the newest volume out in English, for a volume reader's progress
  latestVolume?: number | null;
  // how places show: theirs unless said (a shared shelf says "both": it's
  // sent only what its owner tracks)
  trackBy?: TrackBy;
  // the shelf's Select: the card ticks instead of opening
  select?: { checked: boolean; onToggle: () => void };
};

// The edition they own most of the series in, stamped on its cover like
// "Done": "Definitive +2" (two more editions sit beside it). A row's cover is
// 44px wide, so it carries the edition's few letters ("DEF"); the whole of it
// is said for screen readers and on hover. The server works it out
// (util/shelf/editionStamp.ts); most series, owned as single volumes, have
// none
const STAMP_FULL =
  "absolute bottom-2.5 left-2 max-w-[calc(100%-1rem)] -rotate-5 truncate rounded-[3px] border-2 border-line bg-[color-mix(in_srgb,var(--card)_94%,transparent)] px-2 py-[0.15rem] font-brand text-[1rem] leading-[1.2] tracking-[1.5px] text-ink";
const STAMP_SHORT =
  "absolute inset-x-[2px] bottom-[2px] truncate rounded-[2px] border-[1.5px] border-line bg-card px-px text-center font-brand text-[0.62rem] leading-[1.3] tracking-[0.4px] text-ink";

function EditionStamp({
  stamp,
  shape,
  named = false,
}: {
  stamp: NonNullable<Manga["editionStamp"]>;
  shape: Shape;
  // the card's words already say the edition, in full
  named?: boolean;
}) {
  const more =
    stamp.more > 0
      ? `, and ${stamp.more} more ${stamp.more === 1 ? "edition" : "editions"}`
      : "";
  const said = `${stamp.label} edition${more}`;
  // a New tab card is a cover on laptops and a row on phones
  const full = shape === "news" ? `${STAMP_FULL} upto-720:hidden` : STAMP_FULL;
  const short =
    shape === "news" ? `${STAMP_SHORT} hidden upto-720:block` : STAMP_SHORT;
  return (
    <>
      {shape !== "small" && (
        <span className={full} title={said}>
          <span className="sr-only">{said}</span>
          <span aria-hidden>
            {stamp.label}
            {stamp.more > 0 && (
              <span className="ml-1.5 text-accent-hover">+{stamp.more}</span>
            )}
          </span>
        </span>
      )}
      {shape !== "cover" && !named && (
        <span className={short} title={said}>
          <span className="sr-only">{said}</span>
          <span aria-hidden>{stamp.short}</span>
        </span>
      )}
    </>
  );
}

// every card leans a little differently when you hover it: the 1st, 2nd and
// 3rd of each three tilt their own way. Ticked in Select, it's ringed in red
const coverBase =
  "relative aspect-2/3 rounded-[2px] border-[1.5px] border-line bg-paper-2 transition-[translate,rotate,box-shadow] duration-180 ease-[ease] group-hover:-translate-x-0.5 group-hover:-translate-y-[3px] group-hover:-rotate-1 group-hover:shadow-[6px_7px_0_var(--hard-shadow)] [.group:nth-child(3n+2):hover_&]:rotate-[0.8deg] [.group:nth-child(3n):hover_&]:-rotate-[0.4deg] [[data-picked]_&]:outline-3 [[data-picked]_&]:outline-offset-2 [[data-picked]_&]:outline-accent";

// A card is drawn one of three ways:
//   small   a row with a little cover at every screen size (chosen in Settings)
//   news    a New tab card: a cover on laptops, a row on phones
//   cover   the usual card: a cover with its name under it
type Shape = "small" | "news" | "cover";

const COVER_CLASS: Record<Shape, string> = {
  small: `${coverBase} w-11 shrink-0 shadow-ink`,
  news: `${coverBase} shadow-ink-lg upto-720:w-11 upto-720:shrink-0 upto-720:shadow-ink`,
  cover: `${coverBase} shadow-ink-lg`,
};
// how wide the cover is drawn, so a row asks for a small picture
const COVER_SIZES: Record<Shape, string> = {
  small: "44px",
  news: "(max-width: 720px) 44px, 160px",
  cover: "160px",
};
const TITLE_CLAMP: Record<Shape, string> = {
  small: "line-clamp-1",
  // (no line kept for a second: a short name's news sits right under it)
  news: "line-clamp-2 upto-720:line-clamp-1",
  // one line, cut short with "…": the full name is on hover and on its page
  cover: "line-clamp-1",
};
const ROOT_CLASS: Record<Shape, string> = {
  small: "group flex animate-card-in flex-row items-start gap-3 py-1.5",
  news: "group flex animate-card-in flex-col gap-[0.7rem] upto-720:flex-row upto-720:items-center upto-720:gap-3 upto-720:py-1.5",
  cover: "group flex animate-card-in flex-col gap-[0.7rem]",
};
// how many cards from the top come in with a fade
const FADES_IN = 12;

// a shelf row (small, and not news) lines up in three columns: cover, text,
// and the stars with the progress bar
const ROW_COLUMNS_CLASS =
  "group grid animate-card-in grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-x-3 py-1.5";

export default function MangaCard({
  currentManga,
  news,
  japanFirst,
  detailsSearch = "",
  linkTo,
  onOpen,
  onLongPress,
  index = 0,
  compact = false,
  latestChapter,
  latestVolume,
  trackBy,
  select,
}: Props) {
  const hold = useLongPress(onLongPress);
  // a cover that wouldn't load, so the drawn one shows instead
  let shape: Shape = "cover";
  if (compact) shape = "small";
  else if (news) shape = "news";
  const asColumns = compact && !news;

  const ownTrackBy = useTrackBy();
  const trackingBy = trackBy ?? ownTrackBy;
  const { unit, reading, knownTotal } = progressOf(
    currentManga,
    tracksOf(currentManga, trackingBy),
    latestChapter,
    latestVolume,
  );
  // the row's right side shows "ch. 50 of 101" with its bar: the same rule
  // as RowProgress below
  const progressSaysPlace =
    !currentManga.status && reading > 0 && knownTotal != null;
  const owned = ownedOf(currentManga);
  const ownedText = ownedTextOf(owned, currentManga.editionPlace);
  // where they are: the chapter they're on, the volume they've read, or both
  const placeText = placeOf(currentManga, trackingBy);
  // a row's second line (asColumns)
  const rowLine = progressSaysPlace
    ? null
    : currentManga.planned
      ? "to read"
      : placeText;
  const genre = genreOf(currentManga);
  const kindLine = rowKindLine(currentManga);

  const rootClass = asColumns ? ROW_COLUMNS_CLASS : ROOT_CLASS[shape];
  let newsGenreHidden = "";
  if (news) newsGenreHidden = compact ? " hidden" : " upto-720:hidden";
  // the first screenful comes in one after another; cards added further
  // down as a long shelf grows show at once, never fading in mid-scroll
  const delay =
    index < FADES_IN
      ? { animationDelay: `${index * 35}ms` }
      : { animation: "none" };

  const body = (
    <>
      <div className={COVER_CLASS[shape]}>
        {/* a row's thumbnail asks for a small picture, a card for a full
            one */}
        <SeriesPicture
          name={currentManga.name}
          lightNovel={currentManga.lightNovel}
          url={currentManga.image}
          sizes={COVER_SIZES[shape]}
          japanFirst={japanFirst}
        />
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
        {currentManga.editionStamp && (
          <EditionStamp
            stamp={currentManga.editionStamp}
            shape={shape}
            // the card's own words name the edition already ("own
            // Definitive 1–2", "Definitive 3 next"): no cut-short stamp
            // ("Def.") too
            named={
              Boolean(news?.text.includes(currentManga.editionStamp.label)) ||
              (!asColumns &&
                Boolean(ownedText?.includes(currentManga.editionStamp.label)))
            }
          />
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
          title={shape === "cover" ? currentManga.name : undefined}
          className={`${TITLE_CLAMP[shape]} wrap-anywhere font-display text-[1.05rem] leading-[1.25] font-semibold decoration-accent underline-offset-3 group-hover:underline`}
        >
          {currentManga.name}
        </p>
        {/* a row gives the chapter its own line: it's what they came to see */}
        {asColumns ? (
          <>
            {/* a phone has no room for the stars' own column (below): a
                rating they've given gets a line of its own under the name */}
            {Number(currentManga.rating) > 0 && (
              <span className="hidden upto-720:flex">
                <StarRating value={Number(currentManga.rating)} size="sm" />
              </span>
            )}
            {/* their place, when the right side doesn't say it already
                ("ch. 245" with no total known), or "to read". What they own
                is the Volumes tab's (VolumesView.tsx), never a row's here */}
            {rowLine && (
              <p className="truncate font-mono text-[0.85rem] font-medium text-ink-soft">
                {rowLine}
              </p>
            )}
            {kindLine && (
              <p className="truncate font-mono text-[0.78rem] text-muted">
                {kindLine}
              </p>
            )}
          </>
        ) : (
          <p
            // on the New tab the genre makes way for the news on a small card
            className={`min-h-[1.5em] truncate font-mono text-[0.78rem] text-muted${newsGenreHidden}`}
          >
            {news ? genre : coverLine(currentManga, placeText, ownedText)}
          </p>
        )}
        {news && (
          // red when it's the newest volume; grey when it's a step through
          // a backlog, with how far behind they are under it
          <p
            className={`font-brand text-[1.05rem] tracking-[1px] ${news.behind ? "text-ink-soft" : "text-accent"}`}
          >
            {/* the edition's name in full ("Definitive 3 next", never "Def."),
                and how far behind on a line of its own under it */}
            {news.text}
            {news.behind && (
              <span className="block text-[0.92rem]">{news.behind}</span>
            )}
          </p>
        )}
        {news && (
          <p className="min-h-[1.3em] text-[0.82rem] leading-[1.3] text-ink-soft">
            {news.yours && <KeepRanges text={news.yours} />}
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
          <span className="flex w-36 shrink-0 flex-col justify-center gap-1 pr-2.5 text-right font-mono text-[0.82rem] text-ink-soft upto-720:w-[min(7.5rem,32vw)] upto-720:text-[0.75rem] upto-720:pr-2">
            <RowProgress
              finished={currentManga.status}
              ownedCount={owned.length}
              unit={unit}
              reading={reading}
              knownTotal={knownTotal}
            />
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
      {...hold}
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

// the right side of a shelf row: "Finished", how many books a collector has,
// or how far through they are with a bar under it
function RowProgress({
  finished,
  ownedCount,
  unit,
  reading,
  knownTotal,
}: {
  finished: boolean;
  ownedCount: number;
  // what the numbers count: "ch." or "vol."
  unit: "ch." | "vol.";
  reading: number;
  knownTotal: number | null;
}) {
  if (finished) return "Finished";
  // no chapter kept: how many books, not "0 of 143"
  if (!reading && ownedCount)
    return (
      <span className="whitespace-nowrap pr-2.5">
        {ownedCount} {ownedCount === 1 ? "vol" : "vols"}
      </span>
    );
  if (knownTotal == null || reading <= 0) return null;
  const percent = knownTotal ? Math.min((reading / knownTotal) * 100, 100) : 0;
  return (
    <>
      {/* one line at the usual sizes; at a phone's largest text the column
          keeps its share of the row and this wraps, leaving the series'
          own words their room */}
      <span className="[text-wrap:balance]">
        {/* "ch. 50 of 101", "vol. 5 of 12", "book 3 of 9" */}
        {unit} {reading} of {knownTotal}
      </span>
      <span
        className="block h-1.5 overflow-hidden rounded-full border border-line bg-card"
        aria-hidden
      >
        <span
          className="block h-full bg-accent"
          style={{ width: `${percent}%` }}
        />
      </span>
    </>
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

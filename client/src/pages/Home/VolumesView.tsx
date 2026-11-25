// The shelf's Volumes tab: what they own, series by series. Each is a compact
// row with a bar of what's theirs, a break wherever a volume or book isn't
// (components/ownedBar). Opening it shows the series page's own shelf
// (Details/ShelfBox.tsx), where a tap marks a book theirs and a slide across
// several can be undone, opened at their first gap; a tap on the bar moves
// it along. Under it, what finishing the series costs (FinishList.tsx).
import { useVisitState } from "../../lib/visitState";
import SeriesPicture from "../../components/cover/SeriesPicture";
import { useRef, useState } from "react";
import RangePager from "../../components/rangePager/RangePager";
import { NavLink } from "react-router";
import { ChevronDownIcon } from "../../components/icons/Icons";
import Mascot from "../../components/mascot/Mascot";
import OwnedBar from "../../components/ownedBar/OwnedBar";
import { ownedCount, ownedOf, rangesText } from "../../lib/ownedVolumes";
import { priceName, wholeMoney } from "../../lib/prices";
import type { Manga } from "../../lib/types";
import { totalText, type FinishRow } from "../../lib/collector";
import { slotsOf } from "../../lib/editionShelf";
import { todayOf } from "../../lib/editionNews";
import { useTrackBy } from "../../lib/prefs";
import { tracksOf } from "../../lib/reading";
import { placeOnShelf } from "../../lib/chapterVolumes";
import { savedLatestVolume } from "../../lib/releaseCache";
import { useShelf } from "../../store/shelf";
import ShelfBox from "../Details/ShelfBox";
import { shelfSize } from "../Details/releaseNews";
import { useBuyOptions } from "../Details/useBuyOptions";
import { useEditions } from "../Details/useEditions";
import { useOwnedVolumes } from "../Details/useOwnedVolumes";
import FinishList from "./FinishList";
import ShowMoreButton from "./ShowMoreButton";
import { homeStyles } from "./styles";
import { inApp } from "../../lib/inApp";
import { hasBottomBar } from "../../lib/bottomBar";
import ShelfTotals from "./ShelfTotals";
import { useShelfTools } from "./useShelfTools";
import { volumesStyles as styles } from "./volumesStyles";
import { readSession, writeSession } from "./shelfViews";
import { VOLUMES_OPEN_KEY } from "../../lib/shelfTabKey";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

const OPEN_KEY = VOLUMES_OPEN_KEY;

// series a page, as the shelf's
const PAGE_SIZE = 24;

export default function VolumesView({
  manga,
  searching,
  resetKey,
}: {
  // the shelf's list, already searched and sorted; only ones with volumes
  manga: Manga[];
  searching: boolean;
  // a new search or sort starts again from the first page
  resetKey: string;
}) {
  // the series opened, kept for this browser tab: back from a volume's
  // prices, it's still open where they left it
  const [open, setOpenNow] = useState<number | null>(
    () => Number(readSession(OPEN_KEY, "")) || null,
  );
  const setOpen = (next: number | null) => {
    setOpenNow(next);
    writeSession(OPEN_KEY, next == null ? "" : String(next));
  };
  // which page of series, back as it was with Back (lib/visitState.ts)
  const [page, setPage] = useVisitState("volumes-tab-page", {
    key: resetKey,
    index: 0,
  });
  // what the shelf is worth and what finishing each series costs
  const tools = useShelfTools();
  const finishOf = new Map(tools?.finish.map((f) => [f.mangaId, f]));
  // each series' worth: said or not by the shelf total's rule (totalText),
  // in whole dollars, a row being a glance ("worth $728", "worth about $50")
  const worthOf = new Map(
    (tools?.seriesWorth ?? []).map((w) => {
      const all = w.volumes + w.unlisted;
      const text = totalText(w.cents, w.priced, all, w.estimateCents);
      return [w.mangaId, text && w.priced >= all ? wholeMoney(w.cents) : text];
    }),
  );
  const lastPage = Math.max(0, Math.ceil(manga.length / PAGE_SIZE) - 1);
  const pageIndex = page.key === resetKey ? Math.min(page.index, lastPage) : 0;
  // in the app on a phone the list grows as they scroll, as the shelf's
  // other tabs do (Home.tsx `growing`); elsewhere it turns pages
  const growing = inApp() && hasBottomBar();
  const shown = manga.slice(
    growing ? 0 : pageIndex * PAGE_SIZE,
    (pageIndex + 1) * PAGE_SIZE,
  );
  const listRef = useRef<HTMLUListElement>(null);
  const toggle = (id: number) => setOpen(open === id ? null : id);
  // the bottom one takes them up to the new page; the top one is already there
  const pager = (scrollUp: boolean) => (
    <RangePager
      total={manga.length}
      pageSize={PAGE_SIZE}
      page={pageIndex}
      onChange={(index) => {
        setPage({ key: resetKey, index });
        setOpen(null);
        if (scrollUp)
          listRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }}
      label="Volumes pages"
      labelFor={(start, end) => `${start + 1}–${end + 1}`}
    />
  );

  if (!manga.length) {
    return (
      <div className={styles.empty}>
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood={searching ? "confused" : "happy"} />
        </span>
        <p className={styles.emptyTitle}>
          {searching ? "No matches." : "No volumes on your shelf yet."}
        </p>
        <p className={styles.emptyBody}>
          {searching
            ? "Nothing you own matches that search."
            : "Open a series and tick the volumes you own."}
        </p>
      </div>
    );
  }

  const volumes = manga.reduce((sum, m) => sum + ownedCount(m), 0);
  // the tour opens a series with a real gap, a volume missing between ones
  // they own, or else the first with any still to get
  const hasHole = (m: Manga) => {
    const newestOwned = Math.max(...ownedOf(m));
    return Boolean(
      finishOf.get(m.id)?.missing.some((v) => v.volume < newestOwned),
    );
  };
  const firstWithGaps = (
    shown.find(hasHole) ?? shown.find((m) => finishOf.get(m.id))
  )?.id;
  return (
    <section aria-label="Volumes you own">
      <p className={styles.summary}>
        {plural(volumes, "volume")} across{" "}
        {plural(manga.length, "series", "series")}
      </p>
      {tools && !searching && <ShelfTotals tools={tools} owned={volumes} />}
      {!growing && pager(false)}
      <ul ref={listRef} className={styles.list}>
        {shown.map((m) => (
          <SeriesRow
            key={m.id}
            manga={m}
            tourTarget={m.id === firstWithGaps}
            finish={finishOf.get(m.id)}
            worth={worthOf.get(m.id) ?? null}
            open={open === m.id}
            onToggle={() => toggle(m.id)}
          />
        ))}
      </ul>
      {growing
        ? shown.length < manga.length && (
            <div className={styles.pagerBottom}>
              <ShowMoreButton
                className={homeStyles.showMore}
                bySelf
                onShowMore={() =>
                  setPage({ key: resetKey, index: pageIndex + 1 })
                }
              >
                Show {Math.min(PAGE_SIZE, manga.length - shown.length)} more
                <span className={homeStyles.showMoreCount}>
                  {shown.length.toLocaleString()} of{" "}
                  {manga.length.toLocaleString()}
                </span>
              </ShowMoreButton>
            </div>
          )
        : manga.length > PAGE_SIZE && (
            <div className={styles.pagerBottom}>{pager(true)}</div>
          )}
    </section>
  );
}

// "48, 55–56 +2 more": a long list of gaps never fills the line
function shortRanges(volumes: number[]) {
  const runs = rangesText(volumes).split(", ");
  const more = runs.length > 2 ? ` +${runs.length - 2} more` : "";
  return runs.slice(0, 2).join(", ") + more;
}

// the volumes missing before the furthest they own, in order
const gapsOf = (owned: number[]) => {
  const mine = new Set(owned);
  const furthest = Math.floor(Math.max(0, ...owned));
  return Array.from({ length: furthest }, (_, i) => i + 1).filter(
    (v) => !mine.has(v),
  );
};

function SeriesRow({
  manga: shelfManga,
  tourTarget,
  finish,
  worth,
  open,
  onToggle,
}: {
  manga: Manga;
  tourTarget: boolean;
  finish?: FinishRow;
  // what the series would fetch used ("about $50"), as the shelf's total
  // works it out; null until enough of it is priced
  worth: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  // ticked on the open shelf: shown at once, row and shelf alike, before
  // the shelf's list comes back with it saved. A new list from the shelf
  // starts it again
  const [kept, setKept] = useState({ from: shelfManga, manga: shelfManga });
  if (kept.from !== shelfManga)
    setKept({ from: shelfManga, manga: shelfManga });
  const manga = kept.from === shelfManga ? kept.manga : shelfManga;
  const setManga: React.Dispatch<React.SetStateAction<Manga | null>> = (next) =>
    setKept((k) => {
      const value = typeof next === "function" ? next(k.manga) : next;
      return { ...k, manga: value ?? k.manga };
    });
  const m = manga;
  // a tap on the bar: the shelf under it opens there
  const [jump, setJump] = useState<{ at: number; n: number } | null>(null);
  const owned = ownedOf(m);
  // the newest out, as the release check last found it
  const release = useShelf((s) => s.releases[m.id]);
  const latest = release?.latestVolume ?? savedLatestVolume(m.id);
  const furthest = Math.floor(Math.max(0, ...owned));
  const missingTop = Math.max(
    0,
    ...(finish?.edition ? [] : (finish?.missing ?? []).map((v) => v.volume)),
  );
  const total = Math.max(furthest, latest ?? 0, missingTop);
  const books = m.editionPlace?.books ?? null;
  const panelId = `volumes-${m.id}`;
  return (
    <li id={`series-${m.id}`} className={styles.item}>
      <button
        type="button"
        className={styles.row}
        aria-expanded={open}
        aria-controls={panelId}
        data-tour={tourTarget ? "gaps" : undefined}
        onClick={onToggle}
      >
        <span className={styles.thumb} aria-hidden>
          <SeriesPicture
            name={m.name}
            lightNovel={m.lightNovel}
            url={m.image}
            sizes="36px"
          />
        </span>
        <span className={styles.rowText}>
          {/* the name, then what those volumes would fetch and how many */}
          <span className={styles.rowTop}>
            <span className={styles.name}>
              {/* a long title ends in "…": the worth and count keep their room */}
              <span className={styles.nameText}>{m.name}</span>
            </span>
            {worth && <span className={styles.rowWorth}>worth {worth}</span>}
            <span className={styles.count}>{owned.length}</span>
          </span>
          {/* what they own, a break where a volume or book isn't; said in
              words for screen readers */}
          <span className="sr-only">
            {owned.length === 1 ? "vol." : "vols."} {rangesText(owned)}
          </span>
          <OwnedBar
            owned={owned}
            total={total}
            books={books}
            onPick={
              open ? (at) => setJump({ at, n: (jump?.n ?? 0) + 1 }) : undefined
            }
          />
        </span>
        <ChevronDownIcon className={styles.chevron} />
      </button>
      {open && (
        <SeriesShelf
          id={panelId}
          manga={m}
          setManga={setManga}
          latest={latest}
          jump={jump}
          finish={finish}
          tourTarget={tourTarget}
        />
      )}
    </li>
  );
}

// an opened series: the series page's own shelf, and what's left to buy
function SeriesShelf({
  id,
  manga,
  setManga,
  latest,
  jump,
  finish,
  tourTarget,
}: {
  id: string;
  manga: Manga;
  setManga: React.Dispatch<React.SetStateAction<Manga | null>>;
  latest: number | null;
  jump: { at: number; n: number } | null;
  finish?: FinishRow;
  tourTarget: boolean;
}) {
  const owned = ownedOf(manga);
  const trackBy = useTrackBy();
  const [failed, setFailed] = useState(false);
  // as the series page asks: what's out, and the edition they collect
  const buyOptions = useBuyOptions(priceName(manga), {
    volumesOwned: manga.volumesOwned ?? null,
    ownedList: manga.ownedList,
  });
  const editions = useEditions(
    manga.lightNovel ? null : priceName(manga),
    manga.id,
    manga.edition,
    owned,
    buyOptions.volumes.map((v) => v.isbn13),
  );
  const ownedVolumes = useOwnedVolumes({
    manga,
    setManga,
    onTick: () => setFailed(false),
    onFailed: () => setFailed(true),
  });
  const furthest = Math.floor(Math.max(0, ...owned));
  const shelfTotal = shelfSize(furthest, latest, buyOptions);
  const edition =
    editions.line && shelfTotal.isKnown
      ? {
          line: editions.line,
          slots: slotsOf(editions.line, shelfTotal.size, todayOf()),
        }
      : null;
  const gaps = gapsOf(owned);
  // a phone's page of books opens at their first gap, or where the bar was
  // tapped
  const opensAt = jump?.at ?? gaps[0] ?? null;
  return (
    // the tour's gaps step lights the whole of it: the shelf and what the
    // gaps cost, its bubble kept off both
    <div
      id={id}
      className={styles.panel}
      data-tour={tourTarget ? "gaps-open" : undefined}
    >
      <div className={styles.panelHead}>
        {gaps.length > 0 && !edition && (
          <p className={styles.panelSummary}>
            Not on your shelf: {shortRanges(gaps)}
          </p>
        )}
        <NavLink
          to={`/details/${manga.id}`}
          className={`${styles.edit} ml-auto`}
          viewTransition
        >
          Open series
        </NavLink>
      </div>
      <div>
        <ShelfBox
          // a tap on the bar starts the shelf again at that spot
          key={jump?.n ?? 0}
          mangaId={manga.id}
          name={manga.name}
          owned={owned}
          total={shelfTotal.size}
          totalKnown={shelfTotal.isKnown}
          ownedVolumes={ownedVolumes}
          place={placeOnShelf(manga, tracksOf(manga, trackBy), [])}
          edition={edition}
          heading={false}
          opensAt={opensAt}
        />
      </div>
      {failed && (
        <p className={styles.note} role="alert">
          That didn't save. Try again.
        </p>
      )}
      {finish && (
        <FinishList row={finish} series={priceName(manga)} owned={owned} />
      )}
    </div>
  );
}

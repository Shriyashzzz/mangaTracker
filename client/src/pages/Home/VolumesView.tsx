// The shelf's Volumes tab: what they own, series by series. Each is a compact
// row ("One Piece · 2 · vols. 1, 4"); opening it shows the series' volumes
// as covers, theirs inked in and the rest faded as "Not on your shelf", each one a
// link to its prices. The covers come from the price checker's series list,
// asked only when a row is opened.
import { useVisitState } from "../../lib/visitState";
import Cover from "../../components/cover/Cover";
import SeriesPicture from "../../components/cover/SeriesPicture";
import { useEffect, useRef, useState } from "react";
import RangePager from "../../components/rangePager/RangePager";
import { NavLink } from "react-router";
import { CheckIcon, ChevronDownIcon } from "../../components/icons/Icons";
import Mascot from "../../components/mascot/Mascot";
import { ownedCount, ownedOf, rangesText } from "../../lib/ownedVolumes";
import { getSeries, priceName, volumePath, wholeMoney } from "../../lib/prices";
import type { Manga, SeriesVolume } from "../../lib/types";
import { totalText, type FinishRow } from "../../lib/collector";
import { CoverFallback } from "../Prices/VolumeCard";
import FinishList from "./FinishList";
import ShelfTotals from "./ShelfTotals";
import { useShelfTools } from "./useShelfTools";
import { volumesStyles as styles } from "./volumesStyles";
import { pricesStyles } from "../Prices/styles";
import { readSession, writeSession } from "./shelfViews";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

const OPEN_KEY = "volumesOpen";

// series a page, as the shelf's
const PAGE_SIZE = 20;

// how wide a volume's tile is drawn, for its Cover to pick a size by
const TILE_COVER = "70px";

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
  const shown = manga.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  const listRef = useRef<HTMLUListElement>(null);
  // opening a series: its row goes to the top, just under the shelf's sticky
  // bar. Otherwise the one closing above it pulls the page, and the opened
  // series lands somewhere else
  const toggle = (id: number) => {
    const opening = open !== id;
    setOpen(opening ? id : null);
    if (!opening) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const row = document.getElementById(`series-${id}`);
        const bar = document.querySelector("[data-shelf-bar]");
        if (!row) return;
        const under = (bar?.getBoundingClientRect().bottom ?? 0) + 8;
        window.scrollBy({
          top: row.getBoundingClientRect().top - under,
          behavior: "smooth",
        });
      }),
    );
  };
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
      {pager(false)}
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
      {manga.length > PAGE_SIZE && (
        <div className={styles.pagerBottom}>{pager(true)}</div>
      )}
    </section>
  );
}

function SeriesRow({
  manga,
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
  const owned = ownedOf(manga);
  const panelId = `volumes-${manga.id}`;
  return (
    <li id={`series-${manga.id}`} className={styles.item}>
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
            name={manga.name}
            lightNovel={manga.lightNovel}
            url={manga.image}
            sizes="36px"
          />
        </span>
        <span className={styles.rowText}>
          <span className={styles.name}>
            {manga.name}
            {manga.lightNovel && (
              <span className={styles.tag}>Light novel</span>
            )}
          </span>
          <span className={styles.which}>
            {owned.length === 1 ? "vol." : "vols."} {rangesText(owned)}
            {finish && (
              <span className={styles.toGo}>
                <span className="upto-520:hidden"> · </span>
                {finish.missing.length}
                {finish.edition &&
                  ` ${finish.edition} book${finish.missing.length === 1 ? "" : "s"}`}{" "}
                not on your shelf
              </span>
            )}
          </span>
        </span>
        {/* how many they own, and under it what those would fetch */}
        <span className={styles.side}>
          <span className={styles.count}>{owned.length}</span>
          {worth && <span className={styles.rowWorth}>worth {worth}</span>}
        </span>
        <ChevronDownIcon className={styles.chevron} />
      </button>
      {open && (
        <SeriesVolumes
          tourTarget={tourTarget}
          id={panelId}
          manga={manga}
          owned={owned}
          finish={finish}
        />
      )}
    </li>
  );
}

type Tile = { volume: number; book?: SeriesVolume; yours: boolean };

function SeriesVolumes({
  tourTarget,
  id,
  manga,
  owned,
  finish,
}: {
  tourTarget: boolean;
  id: string;
  manga: Manga;
  owned: number[];
  finish?: FinishRow;
}) {
  // undefined while asking; null if the list couldn't be had
  const [list, setList] = useState<SeriesVolume[] | null | undefined>();
  // only the volumes not on the shelf, as the series page's own filter
  const [toGetOnly, setToGetOnly] = useVisitState(
    `volumes-not-on-shelf-${manga.id}`,
    false,
  );
  // the series the price checker knows it as: a light novel's is its own
  const series = priceName(manga);
  useEffect(() => {
    const controller = new AbortController();
    getSeries(series, controller.signal)
      .then((s) => setList(s.volumes))
      .catch(() => {
        if (!controller.signal.aborted) setList(null);
      });
    return () => controller.abort();
  }, [series]);

  // every volume up to the furthest one known: on sale or theirs
  const byNumber = new Map((list ?? []).map((b) => [b.volume, b]));
  const top = Math.max(0, ...owned, ...(list ?? []).map((b) => b.volume));
  const numbers = [
    ...new Set([
      ...Array.from({ length: Math.floor(top) }, (_, i) => i + 1),
      ...owned,
      ...(list ?? []).map((b) => b.volume),
    ]),
  ].sort((a, b) => a - b);
  const tiles: Tile[] = numbers.map((volume) => ({
    volume,
    book: byNumber.get(volume),
    yours: owned.includes(volume),
  }));
  const toGet = tiles.filter((t) => !t.yours).length;
  // the tour points at the first one not on the shelf
  const firstToGet = tourTarget ? tiles.find((t) => !t.yours)?.volume : null;
  // the line above the tiles: still loading, what's missing, or all of it
  let summary = `You own all ${plural(owned.length, "volume")} we know of`;
  // the series' list can take a moment: what they own is known already, and
  // the tiles show it meanwhile
  if (list === undefined) summary = `You own ${plural(owned.length, "volume")}`;
  // with the "Not on your shelf (10)" button beside it, the count of those
  // is the button's: said once, and the two fit side by side on a phone
  else if (toGet && toGet < tiles.length)
    summary = `You own ${owned.length} of ${tiles.length}`;
  else if (toGet)
    summary = `You own ${owned.length} of ${tiles.length} · ${toGet} not on your shelf`;

  return (
    <div id={id} className={styles.panel}>
      <div className={styles.panelHead}>
        <div className={styles.panelSummaryRow}>
          <p className={styles.panelSummary}>{summary}</p>
          {/* a long run with a few holes: just the holes (the series page's
              own "Not on your shelf" button) */}
          {list !== undefined && toGet > 0 && toGet < tiles.length && (
            <button
              type="button"
              className={pricesStyles.toGet}
              aria-pressed={toGetOnly}
              onClick={() => setToGetOnly(!toGetOnly)}
            >
              Not on your shelf ({toGet})
            </button>
          )}
        </div>
        <NavLink
          to={`/update/${manga.id}`}
          className={styles.edit}
          viewTransition
        >
          Edit volumes you own
        </NavLink>
      </div>
      {list === null && (
        <p className={styles.note}>
          Couldn't get its covers right now, so here are the numbers.
        </p>
      )}
      <ul className={styles.tiles}>
        {(list === undefined
          ? owned.map((volume) => ({ volume, yours: true }))
          : tiles.filter((t) => !toGetOnly || !t.yours)
        ).map((t: Tile) => (
          <li key={t.volume}>
            <VolumeTile
              tile={t}
              tourTarget={list !== undefined && t.volume === firstToGet}
              // not while the list is on its way: the real covers are about
              // to arrive, and a stand-in would flash before them
              fallbackCover={list === undefined ? null : manga.image}
              seriesName={priceName(manga)}
            />
          </li>
        ))}
      </ul>
      {finish && <FinishList row={finish} series={series} />}
    </div>
  );
}

function VolumeTile({
  tile,
  tourTarget,
  fallbackCover,
  seriesName,
}: {
  tile: Tile;
  tourTarget: boolean;
  // the series' cover, to stand in for a volume with none of its own
  fallbackCover: string | null;
  seriesName: string;
}) {
  // A cover of its own, or vol. 1 showing the series' as it is: a picture
  // at full strength, which a volume not on the shelf fades. A stand-in is
  // washed out already
  const hasPicture = Boolean(
    tile.book?.coverUrl || (fallbackCover && tile.volume <= 1),
  );
  const inner = (
    <>
      <span className={tile.yours ? styles.cover : styles.coverToGet}>
        {/* behind the volume's own cover: the series' cover standing in,
            washed out, as on the price pages */}
        <CoverFallback
          number={tile.volume}
          seriesCoverUrl={fallbackCover}
          seriesName={seriesName}
          numbered
          small
          // theirs, with no cover of its own: the series' cover as it is,
          // not washed out (that reads as not owned); the corner stamp says
          // which volume
          plain={tile.yours}
        />
        <Cover url={tile.book?.coverUrl} sizes={TILE_COVER} />
        {!tile.yours && hasPicture && (
          <span className={styles.veil} aria-hidden />
        )}
        <span className={styles.vol} aria-hidden>
          {tile.volume}
        </span>
      </span>
      <span className={tile.yours ? styles.label : styles.labelToGet}>
        {tile.yours ? (
          <>
            <CheckIcon className={styles.check} />
            Yours
          </>
        ) : (
          "Not on your shelf"
        )}
      </span>
    </>
  );
  const name = `Vol. ${tile.volume}, ${tile.yours ? "yours" : "not on your shelf"}`;
  // a volume on sale links to its prices; one we know nothing about is just
  // its number
  return tile.book ? (
    <NavLink
      to={volumePath(tile.book.isbn13, tile.book.title)}
      className={styles.tile}
      data-tour={tourTarget ? "gaps-open" : undefined}
      aria-label={`${name}: see prices`}
      viewTransition
    >
      {inner}
    </NavLink>
  ) : (
    <span
      className={styles.tile}
      data-tour={tourTarget ? "gaps-open" : undefined}
      aria-label={name}
      role="img"
    >
      {inner}
    </span>
  );
}

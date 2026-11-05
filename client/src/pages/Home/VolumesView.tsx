// The shelf's Volumes tab: what they own, series by series. Each is a compact
// row ("One Piece · 2 · vols. 1, 4"); opening it shows the series' volumes
// as covers, theirs inked in and the rest faded as "Still to get", each one a
// link to its prices. The covers come from the price checker's series list,
// asked only when a row is opened.
import { useEffect, useRef, useState } from "react";
import RangePager from "../../components/rangePager/RangePager";
import { NavLink } from "react-router";
import { CheckIcon, ChevronDownIcon } from "../../components/icons/Icons";
import Mascot from "../../components/mascot/Mascot";
import { ownedCount, ownedOf, rangesText } from "../../lib/ownedVolumes";
import {
  coverSrc,
  getSeries,
  hideBrokenCover,
  priceName,
  volumePath,
} from "../../lib/prices";
import type { Manga, SeriesVolume } from "../../lib/types";
import { volumesStyles as styles } from "./volumesStyles";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

// series a page, as the shelf's
const PAGE_SIZE = 20;

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
  const [open, setOpen] = useState<number | null>(null);
  const [page, setPage] = useState({ key: resetKey, index: 0 });
  const lastPage = Math.max(0, Math.ceil(manga.length / PAGE_SIZE) - 1);
  const pageIndex = page.key === resetKey ? Math.min(page.index, lastPage) : 0;
  const shown = manga.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  const listRef = useRef<HTMLUListElement>(null);
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
            ? "None of the series you own volumes of fit that."
            : "Say which volumes you own when you add a series, or from its Edit details."}
        </p>
      </div>
    );
  }

  const volumes = manga.reduce((sum, m) => sum + ownedCount(m), 0);
  return (
    <section aria-label="Volumes you own">
      <p className={styles.summary}>
        {plural(volumes, "volume")} across{" "}
        {plural(manga.length, "series", "series")}
      </p>
      {pager(false)}
      <ul ref={listRef} className={styles.list}>
        {shown.map((m) => (
          <SeriesRow
            key={m.id}
            manga={m}
            open={open === m.id}
            onToggle={() => setOpen((o) => (o === m.id ? null : m.id))}
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
  open,
  onToggle,
}: {
  manga: Manga;
  open: boolean;
  onToggle: () => void;
}) {
  const owned = ownedOf(manga);
  const panelId = `volumes-${manga.id}`;
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={styles.row}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className={styles.thumb} aria-hidden>
          {manga.image && (
            <img
              src={manga.image}
              alt=""
              loading="lazy"
              onError={hideBrokenCover}
            />
          )}
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
          </span>
        </span>
        <span className={styles.count}>{owned.length}</span>
        <ChevronDownIcon className={styles.chevron} />
      </button>
      {open && <SeriesVolumes id={panelId} manga={manga} owned={owned} />}
    </li>
  );
}

type Tile = { volume: number; book?: SeriesVolume; yours: boolean };

function SeriesVolumes({
  id,
  manga,
  owned,
}: {
  id: string;
  manga: Manga;
  owned: number[];
}) {
  // undefined while asking; null if the list couldn't be had
  const [list, setList] = useState<SeriesVolume[] | null | undefined>();
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

  return (
    <div id={id} className={styles.panel}>
      <div className={styles.panelHead}>
        <p className={styles.panelSummary}>
          {list === undefined
            ? "Finding its volumes…"
            : toGet
              ? `You own ${owned.length} of ${tiles.length} · ${toGet} still to get`
              : `You own all ${plural(owned.length, "volume")} we know of`}
        </p>
        <NavLink
          to={`/update/${manga.id}`}
          className={styles.edit}
          viewTransition
        >
          Change volumes
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
          : tiles
        ).map((t: Tile) => (
          <li key={t.volume}>
            <VolumeTile tile={t} fallbackCover={manga.image} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function VolumeTile({
  tile,
  fallbackCover,
}: {
  tile: Tile;
  fallbackCover: string | null;
}) {
  const inner = (
    <>
      <span className={tile.yours ? styles.cover : styles.coverToGet}>
        <span className={styles.coverNumber} aria-hidden>
          {tile.volume}
        </span>
        {tile.book?.coverUrl ? (
          <img
            src={coverSrc(tile.book.coverUrl)}
            alt=""
            loading="lazy"
            onError={(e) => {
              if (fallbackCover && e.currentTarget.src !== fallbackCover) {
                e.currentTarget.src = fallbackCover;
              } else hideBrokenCover(e);
            }}
          />
        ) : null}
        {!tile.yours && tile.book?.coverUrl && (
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
          "Still to get"
        )}
      </span>
    </>
  );
  const name = `Vol. ${tile.volume}, ${tile.yours ? "yours" : "still to get"}`;
  // a volume on sale links to its prices; one we know nothing about is just
  // its number
  return tile.book ? (
    <NavLink
      to={volumePath(tile.book.isbn13, tile.book.title)}
      className={styles.tile}
      aria-label={`${name}: see prices`}
      viewTransition
    >
      {inner}
    </NavLink>
  ) : (
    <span className={styles.tile} aria-label={name} role="img">
      {inner}
    </span>
  );
}

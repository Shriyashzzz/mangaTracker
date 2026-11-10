import { notOutYet, onSale } from "../../lib/releaseDate";
import DealsStrip from "../../components/deals/DealsStrip";
import ToReadButton from "../../components/toRead/ToReadButton";
import { useEffect, useState, type FormEvent } from "react";
import { NavLink, useParams, useSearchParams } from "react-router";
import type { Series, SeriesVolume } from "../../lib/types";
import {
  coverSrc,
  formatCents,
  getSeries,
  hideBrokenCover,
  novelParts,
} from "../../lib/prices";
import { finishCost, finishText, stillToGet } from "../../lib/finishCost";
import { useFromShelf } from "../../lib/fromShelf";
import { findOnShelf } from "../../lib/shelf";
import { nextToGet, owns } from "../../lib/ownedVolumes";
import { useAuth } from "../../store/auth";
import type { ShelfMatch } from "../../lib/types";
import BackToNew from "./BackToNew";
import VolumeCard from "./VolumeCard";
import SeriesFacts from "./SeriesFacts";
import RangePager from "../../components/rangePager/RangePager";
import { pricesStyles as styles } from "./styles";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { usePageMeta } from "../../lib/seo";
import { seriesMeta } from "./pageMeta";

const PAGE_SIZE = 30;

// "Preorder · out Mar 30, 2027" for a volume not out yet, else nothing
function preorder(published?: string) {
  if (!published || !notOutYet(published)) return null;
  const [y, m, d] = published.split("-").map(Number);
  const out = new Date(y!, m! - 1, d || 1);
  return `Preorder · out ${out.toLocaleDateString("en-US", {
    month: "short",
    ...(d ? { day: "numeric" } : {}),
    year: "numeric",
  })}`;
}

// the series' volumes as cards: one each, except that the volumes of one book
// holding several (same ISBN, side by side) share a card. The shelf and its
// data still count each volume on its own
function cards(volumes: SeriesVolume[]) {
  const all: SeriesVolume[][] = [];
  for (const v of volumes) {
    const last = all[all.length - 1];
    if (v.inBook && last?.[0]?.inBook && last[0].isbn13 === v.isbn13)
      last.push(v);
    else all.push([v]);
  }
  return all;
}

export default function PriceSeries() {
  const fromShelf = useFromShelf();
  // the route always has a :slug
  const slug = useParams().slug!;
  const [params] = useSearchParams();
  // the link carries the real name; a bare slug still works as a search
  const name = params.get("name") ?? slug.replace(/-/g, " ");
  // `key` names the request a result answers: the series plus the attempt
  const [state, setState] = useState<{
    key: string | null;
    data: Series | null;
    error: string;
  }>({ key: null, data: null, error: "" });
  // bumping this asks the server again ("Try again")
  const [attempt, setAttempt] = useState(0);
  const key = `${name}|${attempt}`;
  // which block of volumes is showing; resets when the series changes
  const [page, setPage] = useState({ name, index: 0 });
  const pageIndex = page.name === name ? page.index : 0;
  // the series on their shelf, if it is: which volumes are theirs, and the
  // next one they need
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [shelf, setShelf] = useState<{ name: string; manga: ShelfMatch }>({
    name: "",
    manga: null,
  });
  // "Not on your shelf" on or off, and which of its pages, for this series
  // only: another series starts afresh. ?toget=1 (the details page's Buy it
  // card) opens on it
  const [filter, setFilter] = useState<{
    name: string;
    on: boolean;
    page: number;
  } | null>(null);
  const toGetOnly =
    filter?.name === name ? filter.on : params.get("toget") === "1";
  const toGetPageIndex = filter?.name === name ? filter.page : 0;
  const setToGetOnly = (on: boolean) => setFilter({ name, on, page: 0 });
  const setToGetPageIndex = (page: number) =>
    setFilter({ name, on: toGetOnly, page });
  useEffect(() => {
    if (!isSignedIn) return;
    const controller = new AbortController();
    findOnShelf(name, controller.signal)
      .then((manga) => setShelf({ name, manga }))
      // can't tell: the page is the same as for anyone else
      .catch(() => {});
    return () => controller.abort();
  }, [isSignedIn, name]);

  useEffect(() => {
    const controller = new AbortController();
    getSeries(name, controller.signal)
      .then((data) => setState({ key, data, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError") {
          setState({ key, data: null, error: e.message });
        }
      });
    return () => controller.abort();
    // key already includes name
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = () => setAttempt((a) => a + 1);
  usePageMeta(state.key === key && state.data ? seriesMeta(state.data) : null);

  if (state.key !== key) {
    return (
      <div className={styles.page} aria-busy="true" aria-label="Loading">
        <SlowLoadQuote />
        <div className="skeleton" style={{ height: 220 }} />
        <div className={styles.grid}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`skeleton ${styles.cardSkeleton}`} />
          ))}
        </div>
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className={styles.empty} role="alert">
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="panic" />
        </span>
        <p className={styles.emptyTitle}>Couldn't open this series.</p>
        <p>{state.error}</p>
        <div className={styles.emptyActions}>
          <button type="button" className="btn btn-primary" onClick={retry}>
            Try again
          </button>
          <NavLink to="/" className="btn btn-ghost" viewTransition>
            Back to price check
          </NavLink>
        </div>
      </div>
    );
  }

  const data = state.data;
  const { info, volumes, incomplete } = data;
  const priced = volumes.filter((v) => v.knownPriceCents != null).length;
  // ranges go by volume number, so gaps in the catalog don't skew them
  const lastNumber = Math.max(
    info?.volumes ?? 0,
    ...volumes.map((v) => v.volume),
  );
  const rangeStart = pageIndex * PAGE_SIZE + 1;
  const rangeEnd = rangeStart + PAGE_SIZE - 1;
  const mine = shelf.name === name ? shelf.manga : null;
  const isTheirs = (n: number) =>
    Boolean(mine) && n >= 1 && Number.isInteger(n) && owns(mine!, n);
  // the first whole volume out after the furthest they own (as Buy it says)
  // a preorder isn't next to buy, nor part of what finishing costs
  const next = mine
    ? (nextToGet(
        mine,
        onSale(volumes).map((v) => v.volume),
      ) ?? undefined)
    : undefined;
  // a card's mark: theirs when every volume on it is, next when it holds the
  // next one they need
  const markOf = (card: SeriesVolume[]) =>
    card.every((v) => isTheirs(v.volume))
      ? ("yours" as const)
      : card.some((v) => v.volume === next)
        ? ("next" as const)
        : undefined;
  const toGet = mine ? stillToGet(volumes, mine) : volumes;
  // what the rest costs, at stored prices only (lib/finishCost.ts)
  const finish = mine ? finishCost(onSale(toGet)) : null;
  // "Not on your shelf" pages through just those, 30 at a time, in place of
  // the volume ranges, so the controls keep their shape
  const toGetShown = Boolean(mine) && toGetOnly;
  const toGetPage = Math.min(
    toGetPageIndex,
    Math.max(0, Math.ceil(toGet.length / PAGE_SIZE) - 1),
  );
  const shown = toGetShown
    ? toGet.slice(toGetPage * PAGE_SIZE, (toGetPage + 1) * PAGE_SIZE)
    : volumes.filter(
        (v) =>
          (v.volume >= rangeStart || (pageIndex === 0 && v.volume < 1)) &&
          v.volume <= rangeEnd,
      );
  // to the block holding that volume, then to the volume itself
  const jumpToVolume = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const number = Number(new FormData(e.currentTarget).get("volume"));
    if (!Number.isFinite(number) || number < 1) return;
    // filtered: to its page of "Not on your shelf"; one they own isn't
    // there, so the filter goes off and it's found in the full list
    const inToGet = toGetShown
      ? toGet.findIndex((v) => v.volume === number)
      : -1;
    if (inToGet >= 0) setToGetPageIndex(Math.floor(inToGet / PAGE_SIZE));
    else {
      if (toGetShown) setToGetOnly(false);
      setPage({ name, index: Math.floor((number - 1) / PAGE_SIZE) });
    }
    requestAnimationFrame(() =>
      document
        .getElementById(`vol-${number}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  };
  const changePage = (index: number) => {
    setPage({ name, index });
    document
      .getElementById("volumes-title")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // a light novel's series is "Overlord Light Novel": shown as Overlord, tagged
  const named = novelParts(info?.name ?? data.name);
  return (
    <div className={`${styles.page} fade-in`}>
      {fromShelf && <BackToNew />}
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <NavLink to="/" className="tap" viewTransition>
          Price check
        </NavLink>
        <span aria-hidden>/</span>
        <span aria-current="page">{named.title}</span>
      </nav>
      <DealsStrip />

      <header className={styles.seriesHead}>
        {/* the US edition's first volume; AniList's cover is the Japanese one */}
        {(volumes[0]?.coverUrl || info?.coverUrl) && (
          <img
            className={styles.seriesCover}
            src={
              volumes[0]?.coverUrl
                ? coverSrc(volumes[0].coverUrl)
                : (info?.coverUrl ?? undefined)
            }
            alt=""
            onError={(e) => {
              // no US cover on file: fall back to AniList's, and if that
              // fails too (or there isn't one), show nothing rather than a
              // broken image
              if (info?.coverUrl && e.currentTarget.src !== info.coverUrl) {
                e.currentTarget.src = info.coverUrl;
              } else {
                hideBrokenCover(e);
              }
            }}
          />
        )}
        <div className={styles.seriesCopy}>
          <h1 className={styles.volumeTitle}>{named.title}</h1>
          {named.lightNovel && (
            <p className={styles.isbn}>
              <span className={styles.tag}>Light novel</span>
            </p>
          )}
          {info && <SeriesFacts info={info} />}
          <ToReadButton
            name={info?.name ?? data.name}
            altNames={info?.altNames}
            cover={info?.coverUrl ?? null}
            genres={info?.genres}
          />
        </div>
      </header>

      <section aria-labelledby="volumes-title">
        <div className={styles.sectionHeadRow}>
          <h2 id="volumes-title" className={styles.sectionTitle}>
            Volumes
          </h2>
          {volumes.length > 0 && (
            <span className={styles.checked}>
              {volumes.length} in English
              {priced < volumes.length && " · Prices load when you open one"}
            </span>
          )}
        </div>
        {/* what's left of their series, and what it costs at stored prices */}
        {(finish || (mine && toGet.length < volumes.length)) && (
          <div className={styles.toGetRow}>
            {mine && toGet.length < volumes.length && (
              <button
                type="button"
                className={styles.toGet}
                aria-pressed={toGetOnly}
                onClick={() => {
                  setToGetOnly(!toGetOnly);
                }}
              >
                Not on your shelf ({toGet.length})
              </button>
            )}
            {finish && (
              <span
                className={styles.finishCost}
                title="At the last checked prices. A volume gets a price once someone opens its page"
              >
                {finishText(finish, formatCents)}
              </span>
            )}
          </div>
        )}
        {toGetShown ? (
          <RangePager
            total={toGet.length}
            pageSize={PAGE_SIZE}
            page={toGetPage}
            onChange={(index) => {
              setToGetPageIndex(index);
              document
                .getElementById("volumes-title")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            label="Volumes not on your shelf"
            // by the volume numbers each page holds, gaps and all
            labelFor={(start, end) =>
              `${toGet[start]?.volume}–${toGet[end]?.volume}`
            }
          />
        ) : (
          <RangePager
            total={lastNumber}
            pageSize={PAGE_SIZE}
            page={pageIndex}
            onChange={changePage}
            label="Volume ranges"
            // short, so a phone's row of them isn't cut off mid-word
            labelFor={(start, end) => `${start + 1}–${end + 1}`}
          />
        )}
        {!toGetShown && volumes.length > 0 && shown.length === 0 && (
          <p className={styles.note}>
            The catalog doesn't have volumes {rangeStart}–
            {Math.min(rangeEnd, lastNumber)} in English yet. Search a volume by
            name or ISBN to price it.
          </p>
        )}
        {volumes.length > 12 && (
          <form className={styles.jump} onSubmit={jumpToVolume}>
            <label htmlFor="jump-volume">Jump to volume</label>
            <input
              id="jump-volume"
              name="volume"
              type="number"
              inputMode="numeric"
              min={1}
              max={lastNumber}
            />
            <button type="submit" className="btn btn-secondary">
              Go
            </button>
          </form>
        )}
        {volumes.length ? (
          <ul className={styles.grid}>
            {cards(shown).map((card) =>
              card.length === 1 ? (
                <li key={card[0]!.volume} id={`vol-${card[0]!.volume}`}>
                  <VolumeCard
                    {...card[0]!}
                    title={`Vol. ${card[0]!.volume}`}
                    fullTitle={card[0]!.title}
                    seriesCoverUrl={info?.coverUrl}
                    priceCents={card[0]!.knownPriceCents}
                    // a book's volume shown alone (the rest on another page,
                    // or on their shelf) still says it comes in that book
                    subtitle={
                      [
                        card[0]!.inBook &&
                          `In Book ${card[0]!.inBook.book} (vols ${card[0]!.inBook.from}–${card[0]!.inBook.to})`,
                        preorder(card[0]!.published) ??
                          (card[0]!.knownPriceCents == null && "Check price"),
                      ]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                    mark={markOf(card)}
                  />
                </li>
              ) : (
                // one book holding several volumes: one stacked card, one
                // price page. Each volume keeps its place for Jump to
                <li key={card[0]!.volume} id={`vol-${card[0]!.volume}`}>
                  {card.slice(1).map((v) => (
                    <span key={v.volume} id={`vol-${v.volume}`} />
                  ))}
                  <VolumeCard
                    {...card[0]!}
                    title={`Book ${card[0]!.inBook!.book}`}
                    fullTitle={card[0]!.title}
                    volume={null}
                    holds={{
                      from: card[0]!.volume,
                      to: card[card.length - 1]!.volume,
                    }}
                    seriesCoverUrl={info?.coverUrl}
                    priceCents={card[0]!.knownPriceCents}
                    subtitle={[
                      `Vols. ${card.map((v) => v.volume).join(" & ")} in one book`,
                      preorder(card[0]!.published) ??
                        (card[0]!.knownPriceCents == null && "Check price"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    mark={markOf(card)}
                  />
                </li>
              ),
            )}
          </ul>
        ) : incomplete ? (
          <div className={styles.note} role="alert">
            <p>
              The book catalog is slow to answer right now, so volumes didn't
              load. It usually works on the next try.
            </p>
            <button type="button" className="btn btn-secondary" onClick={retry}>
              Try again
            </button>
          </div>
        ) : (
          <p className={styles.note}>
            This manga has no English physical volumes released yet. If one is
            out, try searching it by name or ISBN.
          </p>
        )}
        {incomplete && volumes.length > 0 && (
          <p className={styles.checked} role="status">
            Some volumes may be missing: the book catalog was slow to answer.{" "}
            <button type="button" className={styles.textBtn} onClick={retry}>
              Try again
            </button>
          </p>
        )}
      </section>
    </div>
  );
}

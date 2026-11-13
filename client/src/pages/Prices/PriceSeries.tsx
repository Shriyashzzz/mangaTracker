// A series' price page: its cover and facts, box sets or an edition beside
// the title, every English volume as a card with its last known price, and
// the series' other editions. For someone with the series on their shelf it
// marks what's theirs and can list only what isn't. Its parts:
//   useSeriesData.ts     what it asks the server for (three hooks)
//   seriesPageRules.ts   cards, subtitles, pages of the list (pure)
//   SeriesPageParts.tsx  one card of the list, loading and not-found
//   BoxSets, EditionsBox, OtherEditions, SeriesCostBox, SeriesFacts
//   AfterAnime/AfterAnimeBar    the way to where the anime leaves off
import { useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router";
import DealsStrip from "../../components/deals/DealsStrip";
import RangePager from "../../components/rangePager/RangePager";
import ToReadButton from "../../components/toRead/ToReadButton";
import { headlineLine, type EditionLine } from "../../lib/editions";
import {
  finishCost,
  finishText,
  seriesCost,
  stillToGet,
  usedCopies,
} from "../../lib/finishCost";
import { useFromShelf } from "../../lib/fromShelf";
import { nextToGet, ownedOf, rangesText } from "../../lib/ownedVolumes";
import {
  coverSrc,
  formatCents,
  hideBrokenCover,
  novelParts,
} from "../../lib/prices";
import { onSale } from "../../lib/releaseDate";
import { usePageMeta } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import AfterAnimeBar from "../AfterAnime/AfterAnimeBar";
import BackToNew from "./BackToNew";
import BoxSets, { BoxSetSearch } from "./BoxSets";
import { shownSets } from "./boxSetRules";
import EditionsBox from "./EditionsBox";
import OtherEditions from "./OtherEditions";
import { seriesMeta } from "./pageMeta";
import SeriesCostBox from "./SeriesCostBox";
import SeriesFacts from "./SeriesFacts";
import {
  SeriesNotOpened,
  SeriesPageSkeleton,
  SeriesVolumeCard,
} from "./SeriesPageParts";
import {
  cardsOf,
  markOf,
  PAGE_SIZE,
  unlistedNumbers,
  volumesOnPage,
} from "./seriesPageRules";
import { pricesStyles as styles } from "./styles";
import { useBoxSetScan, useSeriesLoad, useShelfMatch } from "./useSeriesData";

// to the top of the list, after its page changes
const scrollToVolumes = () =>
  document
    .getElementById("volumes-title")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function PriceSeries() {
  const fromShelf = useFromShelf();
  // the route always has a :slug
  const slug = useParams().slug!;
  const [params] = useSearchParams();
  // the link carries the real name; a bare slug still works as a search
  const name = params.get("name") ?? slug.replace(/-/g, " ");
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const series = useSeriesLoad(name);
  // the series on their shelf, if it is: which volumes are theirs
  const mine = useShelfMatch(name);
  const scannedSets = useBoxSetScan(name, series.key, Boolean(series.data));

  // which block of volumes is showing; resets when the series changes
  const [page, setPage] = useState({ name, index: 0 });
  const pageIndex = page.name === name ? page.index : 0;
  // "Not on your shelf" on or off, and which of its pages, for this series
  // only: another series starts afresh. ?toget=1 (the details page's Buy it
  // card) opens on it
  const [filter, setFilter] = useState<{
    name: string;
    on: boolean;
    page: number;
  } | null>(null);
  const filterIsForThisSeries = filter?.name === name;
  const toGetOnly = filterIsForThisSeries
    ? filter.on
    : params.get("toget") === "1";
  const toGetPageIndex = filterIsForThisSeries ? filter.page : 0;
  const setToGetOnly = (on: boolean) => setFilter({ name, on, page: 0 });
  const setToGetPageIndex = (index: number) =>
    setFilter({ name, on: toGetOnly, page: index });
  // the series' other editions, once OtherEditions has them
  const [editions, setEditions] = useState<{
    name: string;
    lines: EditionLine[];
  }>({ name: "", lines: [] });

  // couldn't open it (made up, or the lookup failed): never indexed, as the
  // site server already says
  let meta: Parameters<typeof usePageMeta>[0] = null;
  if (!series.loading)
    meta = series.data
      ? seriesMeta(series.data)
      : { title: "Series not found", noindex: true };
  usePageMeta(meta);

  if (series.loading) return <SeriesPageSkeleton />;
  if (series.error || !series.data)
    return <SeriesNotOpened error={series.error} onRetry={series.retry} />;
  const retry = series.retry;

  const data = series.data;
  const { info, volumes, incomplete } = data;
  const priced = volumes.filter((v) => v.knownPriceCents != null).length;
  const unlisted = unlistedNumbers(volumes);
  // ranges go by volume number, so gaps in the catalog don't skew them
  const lastNumber = Math.max(
    info?.volumes ?? 0,
    ...volumes.map((v) => v.volume),
  );
  const rangeStart = pageIndex * PAGE_SIZE + 1;
  const rangeEnd = rangeStart + PAGE_SIZE - 1;
  // what goes beside the title: box sets when one is priced, else an edition
  const editionLines = editions.name === name ? editions.lines : [];
  const boxSets = scannedSets ?? data.boxSets ?? [];
  const hasSets = shownSets(boxSets, editionLines.length > 0).length > 0;
  const headline = headlineLine(editionLines);
  // the first whole volume out after the furthest they own (as Buy it says)
  // a preorder isn't next to buy, nor part of what finishing costs
  const next = mine
    ? (nextToGet(
        mine,
        onSale(volumes).map((v) => v.volume),
      ) ?? undefined)
    : undefined;
  const toGet = mine ? stillToGet(volumes, mine) : volumes;
  // what the rest costs, at stored prices only (lib/finishCost.ts)
  const finish = mine ? finishCost(onSale(toGet), onSale(volumes)) : null;
  // not on their shelf: what collecting all of it costs, to help decide.
  // Whole volumes out now only, a vol. 0 prequel included (a .5 extra or a
  // preorder isn't the run)
  const cost = mine
    ? null
    : seriesCost(
        onSale(volumes).filter(
          (v) => v.volume >= 0 && Number.isInteger(v.volume),
        ),
      );
  // and the used copies found for those same volumes, added up
  const used = cost
    ? usedCopies(
        onSale(volumes).filter(
          (v) => v.volume >= 0 && Number.isInteger(v.volume),
        ),
      )
    : null;
  // "Not on your shelf" pages through just those, 30 at a time, in place of
  // the volume ranges, so the controls keep their shape
  const toGetShown = Boolean(mine) && toGetOnly;
  const toGetPage = Math.min(
    toGetPageIndex,
    Math.max(0, Math.ceil(toGet.length / PAGE_SIZE) - 1),
  );
  const shown = toGetShown
    ? toGet.slice(toGetPage * PAGE_SIZE, (toGetPage + 1) * PAGE_SIZE)
    : volumesOnPage(volumes, pageIndex);
  const changePage = (index: number) => {
    setPage({ name, index });
    scrollToVolumes();
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
        {/* beside the title: a whole run in one buy when a box set is
            priced, else the series' deluxe (or omnibus) edition; neither,
            nothing */}
        {hasSets ? (
          <BoxSets
            sets={boxSets}
            links={data.boxSetLinks ?? []}
            editionsListed={editionLines.length > 0}
          />
        ) : (
          headline && (
            <EditionsBox line={headline} owned={mine ? ownedOf(mine) : []} />
          )
        )}
      </header>

      {/* for someone coming from the anime, before what collecting costs */}
      {info && data.hasAnimeAnswer && <AfterAnimeBar seriesName={info.name} />}

      {cost && (
        <SeriesCostBox
          cost={cost}
          used={used}
          isSignedIn={isSignedIn}
          comingSoon={onSale(volumes).length < volumes.length}
        />
      )}

      <section aria-labelledby="volumes-title">
        <div className={styles.sectionHeadRow}>
          <h2 id="volumes-title" className={styles.sectionTitle}>
            Volumes
          </h2>
          {volumes.length > 0 && (
            <span className={styles.checked}>
              {volumes.length} {volumes.length === 1 ? "volume" : "volumes"} in
              English
              {priced < volumes.length && " · Tap one to see its price"}
            </span>
          )}
        </div>
        {/* said before the covers, so a gap in the numbers isn't a puzzle */}
        {unlisted.length > 0 && (
          <p className={styles.sectionNote} role="status">
            {unlisted.length === 1 ? "Vol." : "Vols."} {rangesText(unlisted)}{" "}
            {unlisted.length === 1 ? "is" : "are"} missing from our list. The
            cost above leaves {unlisted.length === 1 ? "it" : "them"} out.
          </p>
        )}
        {/* what's left of their series, and what it costs at stored prices */}
        {(finish || (mine && toGet.length < volumes.length)) && (
          <div className={styles.toGetRow}>
            {mine && toGet.length < volumes.length && (
              <button
                type="button"
                className={styles.toGet}
                aria-pressed={toGetOnly}
                onClick={() => setToGetOnly(!toGetOnly)}
              >
                Not on your shelf ({toGet.length})
              </button>
            )}
            {/* only once most of the series is priced: a few volumes'
                prices aren't the run's */}
            {finish?.enough && (
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
              scrollToVolumes();
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
        {volumes.length ? (
          <ul className={styles.grid}>
            {cardsOf(shown).map((card) => (
              <SeriesVolumeCard
                key={card[0]!.volume}
                card={card}
                mark={markOf(card, mine, next)}
              />
            ))}
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

      <OtherEditions
        name={name}
        asked={params.get("edition")}
        owned={mine ? ownedOf(mine) : []}
        onLines={(lines) => setEditions({ name, lines })}
      />
      {/* no set priced: where to look for one */}
      {!hasSets && <BoxSetSearch links={data.boxSetLinks ?? []} />}
    </div>
  );
}

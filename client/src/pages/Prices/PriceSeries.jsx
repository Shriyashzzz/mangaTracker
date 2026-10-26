import { useEffect, useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router";
import { coverSrc, getSeries, hideBrokenCover } from "../../lib/prices";
import VolumeCard from "./VolumeCard";
import SeriesFacts from "./SeriesFacts";
import RangePager from "../../components/rangePager/RangePager";
import styles from "./Prices.module.css";
import Mascot from "../../components/mascot/Mascot";

const PAGE_SIZE = 30;

export default function PriceSeries() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  // the link carries the real name; a bare slug still works as a search
  const name = params.get("name") ?? slug.replace(/-/g, " ");
  // `key` names the request a result answers: the series plus the attempt
  const [state, setState] = useState({ key: null, data: null, error: "" });
  // bumping this asks the server again ("Try again")
  const [attempt, setAttempt] = useState(0);
  const key = `${name}|${attempt}`;
  // which block of volumes is showing; resets when the series changes
  const [page, setPage] = useState({ name, index: 0 });
  const pageIndex = page.name === name ? page.index : 0;

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

  if (state.key !== key) {
    return (
      <div className={styles.page} aria-busy="true" aria-label="Loading">
        <div className="skeleton" style={{ height: 220 }} />
        <div className={styles.grid}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`skeleton ${styles.cardSkeleton}`} />
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
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

  const { info, volumes, incomplete } = state.data;
  const priced = volumes.filter((v) => v.knownPriceCents != null).length;
  // ranges go by volume number, so gaps in the catalog don't skew them
  const lastNumber = Math.max(
    info?.volumes ?? 0,
    ...volumes.map((v) => v.volume),
  );
  const rangeStart = pageIndex * PAGE_SIZE + 1;
  const rangeEnd = rangeStart + PAGE_SIZE - 1;
  const shown = volumes.filter(
    (v) =>
      (v.volume >= rangeStart || (pageIndex === 0 && v.volume < 1)) &&
      v.volume <= rangeEnd,
  );
  const changePage = (index) => {
    setPage({ name, index });
    document
      .getElementById("volumes-title")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={`${styles.page} fade-in`}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <NavLink to="/" viewTransition>
          Price check
        </NavLink>
        <span aria-hidden>/</span>
        <span aria-current="page">{info?.name ?? state.data.name}</span>
      </nav>

      <header className={styles.seriesHead}>
        {/* the US edition's first volume; AniList's cover is the Japanese one */}
        {(volumes[0]?.coverUrl || info?.coverUrl) && (
          <img
            className={styles.seriesCover}
            src={
              volumes[0]?.coverUrl
                ? coverSrc(volumes[0].coverUrl)
                : info.coverUrl
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
          <h1 className={styles.volumeTitle}>
            {info?.name ?? state.data.name}
          </h1>
          {info && <SeriesFacts info={info} />}
        </div>
      </header>

      <section aria-labelledby="volumes-title">
        <div className={styles.sectionHead}>
          <h2 id="volumes-title" className={styles.sectionTitle}>
            Volumes
          </h2>
          {volumes.length > 0 && (
            <span className={styles.checked}>
              {volumes.length} in English
              {priced > 0 && ` · ${priced} with prices`}
            </span>
          )}
        </div>
        <RangePager
          total={lastNumber}
          pageSize={PAGE_SIZE}
          page={pageIndex}
          onChange={changePage}
          label="Volume ranges"
          labelFor={(start, end) => `Vol. ${start + 1}–${end + 1}`}
        />
        {volumes.length > 0 && shown.length === 0 && (
          <p className={styles.note}>
            The catalog doesn't have volumes {rangeStart}–
            {Math.min(rangeEnd, lastNumber)} in English yet. Search a volume by
            name or ISBN to price it.
          </p>
        )}
        {volumes.length ? (
          <ul className={styles.grid}>
            {shown.map((v) => (
              <li key={v.isbn13}>
                <VolumeCard
                  {...v}
                  title={`Vol. ${v.volume}`}
                  seriesCoverUrl={info?.coverUrl}
                  priceCents={v.knownPriceCents}
                  subtitle={v.knownPriceCents == null ? "Check price" : null}
                />
              </li>
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
            We couldn't find English volumes for this series yet. Try searching
            a volume by name or ISBN.
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

import { useEffect, useState } from "react";
import { NavLink, useParams, useSearchParams } from "react-router";
import { getSeries } from "../../lib/prices";
import VolumeCard from "./VolumeCard";
import SeriesFacts from "./SeriesFacts";
import RangePager from "../../components/rangePager/RangePager";
import styles from "./Prices.module.css";

const PAGE_SIZE = 30;

export default function PriceSeries() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  // the link carries the real name; a bare slug still works as a search
  const name = params.get("name") ?? slug.replace(/-/g, " ");
  const [state, setState] = useState({ name: null, data: null, error: "" });
  // which block of volumes is showing; resets when the series changes
  const [page, setPage] = useState({ name, index: 0 });
  const pageIndex = page.name === name ? page.index : 0;

  useEffect(() => {
    const controller = new AbortController();
    getSeries(name, controller.signal)
      .then((data) => setState({ name, data, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError") {
          setState({ name, data: null, error: e.message });
        }
      });
    return () => controller.abort();
  }, [name]);

  if (state.name !== name) {
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
        <p className={styles.emptyTitle}>Couldn't open this series.</p>
        <p>{state.error}</p>
        <NavLink to="/prices" className="btn btn-secondary" viewTransition>
          Back to price check
        </NavLink>
      </div>
    );
  }

  const { info, volumes } = state.data;
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
        <NavLink to="/prices" viewTransition>
          Price check
        </NavLink>
        <span aria-hidden>/</span>
        <span aria-current="page">{info?.name ?? state.data.name}</span>
      </nav>

      <header className={styles.seriesHead}>
        {info?.coverUrl && (
          <img className={styles.seriesCover} src={info.coverUrl} alt="" />
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
          <span className={styles.checked}>
            {volumes.length} in English
            {priced > 0 && ` · ${priced} with prices`}
          </span>
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
                  priceCents={v.knownPriceCents}
                  subtitle={v.knownPriceCents == null ? "Check price" : null}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>
            We couldn't find English volumes for this series yet. Try searching
            a volume by name or ISBN.
          </p>
        )}
      </section>
    </div>
  );
}

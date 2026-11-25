// Parts of a series' price page that only draw: one card of the volume list,
// and what shows while the series loads or when it couldn't be opened.
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { bookSubtitle, oneVolumeSubtitle, type Card } from "./seriesPageRules";
import { pricesStyles as styles } from "./styles";
import VolumeCard from "./VolumeCard";

// one card of the list. A volume missing its own cover shows the series'
// cover washed out behind its number tab (VolumeCard's CoverFallback): a
// stand-in, plainly not that volume's own art
export function SeriesVolumeCard({
  card,
  mark,
  seriesCoverUrl,
  seriesName,
  lightNovel,
}: {
  card: Card;
  mark: "yours" | "next" | undefined;
  seriesCoverUrl: string | null;
  seriesName: string;
  // a light novel series: each cover says so (its "Vol. 3" title can't)
  lightNovel: boolean;
}) {
  const first = card[0]!;
  if (card.length === 1)
    return (
      <li id={`vol-${first.volume}`}>
        <VolumeCard
          plainStandIn
          {...first}
          title={`Vol. ${first.volume}`}
          titleOnCover
          fullTitle={first.title}
          priceCents={first.knownPriceCents}
          subtitle={oneVolumeSubtitle(first)}
          mark={mark}
          seriesCoverUrl={seriesCoverUrl}
          seriesName={seriesName}
          lightNovel={lightNovel}
        />
      </li>
    );

  // one book holding several volumes: one stacked card, one price page. Each
  // volume keeps its place on the page for a link to land on
  const last = card[card.length - 1]!;
  return (
    <li id={`vol-${first.volume}`}>
      {card.slice(1).map((v) => (
        <span key={v.volume} id={`vol-${v.volume}`} />
      ))}
      <VolumeCard
        plainStandIn
        {...first}
        title={`Book ${first.inBook!.book}`}
        fullTitle={first.title}
        volume={null}
        holds={{ from: first.volume, to: last.volume }}
        priceCents={first.knownPriceCents}
        subtitle={bookSubtitle(card)}
        mark={mark}
        lightNovel={lightNovel}
      />
    </li>
  );
}

export function SeriesPageSkeleton() {
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

export function SeriesNotOpened({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  // the server's "no such series" (a made-up address): nothing to try again
  if (/couldn't find that series/i.test(error))
    return (
      <div className={styles.empty} role="alert">
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="confused" />
        </span>
        <p className={styles.emptyTitle}>No series by that name.</p>
        <p>Search for it by the name on its cover.</p>
        <div className={styles.emptyActions}>
          <NavLink to="/" className="btn btn-primary" viewTransition>
            Search
          </NavLink>
        </div>
      </div>
    );
  return (
    <div className={styles.empty} role="alert">
      <span className="printed mascot-spot" aria-hidden>
        <Mascot mood="panic" />
      </span>
      <p className={styles.emptyTitle}>Couldn't open this series.</p>
      <p>{error}</p>
      <div className={styles.emptyActions}>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
        <NavLink to="/" className="btn btn-ghost" viewTransition>
          Back to price check
        </NavLink>
      </div>
    </div>
  );
}

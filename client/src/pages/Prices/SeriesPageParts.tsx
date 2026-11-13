// Parts of a series' price page that only draw: one card of the volume list,
// and what shows while the series loads or when it couldn't be opened.
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { bookSubtitle, oneVolumeSubtitle, type Card } from "./seriesPageRules";
import { pricesStyles as styles } from "./styles";
import VolumeCard from "./VolumeCard";

// one card of the list. No series cover stands in for a volume missing its
// own: AniList's is the Japanese first volume, and every gap read as the
// wrong book. The drawn number shows instead
export function SeriesVolumeCard({
  card,
  mark,
}: {
  card: Card;
  mark: "yours" | "next" | undefined;
}) {
  const first = card[0]!;
  if (card.length === 1)
    return (
      <li id={`vol-${first.volume}`}>
        <VolumeCard
          {...first}
          title={`Vol. ${first.volume}`}
          fullTitle={first.title}
          priceCents={first.knownPriceCents}
          subtitle={oneVolumeSubtitle(first)}
          mark={mark}
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
        {...first}
        title={`Book ${first.inBook!.book}`}
        fullTitle={first.title}
        volume={null}
        holds={{ from: first.volume, to: last.volume }}
        priceCents={first.knownPriceCents}
        subtitle={bookSubtitle(card)}
        mark={mark}
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

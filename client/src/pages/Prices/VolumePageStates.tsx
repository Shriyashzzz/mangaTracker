// What a volume's price page shows in place of the volume: it's still
// loading, or it couldn't be opened.
import { NavLink } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { pricesStyles as styles } from "./styles";

export function VolumeSkeleton() {
  return (
    <div className={styles.volume} aria-busy="true" aria-label="Loading">
      <SlowLoadQuote />
      <div
        className={`skeleton ${styles.volumeCover} ${styles.coverSkeleton}`}
      />
      <div className={styles.volumeHead}>
        <div className="skeleton" style={{ width: "70%", height: 44 }} />
        <div className="skeleton" style={{ width: "40%", height: 20 }} />
      </div>
      <div className={styles.volumeBody}>
        <div className="skeleton" style={{ width: "100%", height: 160 }} />
      </div>
    </div>
  );
}

export function VolumeNotOpened({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.empty} role="alert">
      <span className="printed mascot-spot" aria-hidden>
        <Mascot mood="panic" />
      </span>
      <p className={styles.emptyTitle}>Couldn't open this volume.</p>
      <p>Check your connection and try again in a moment.</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Try again
      </button>
      <NavLink to="/" className="btn btn-secondary" viewTransition>
        Back to price check
      </NavLink>
    </div>
  );
}

// What the series page shows in place of a series: it couldn't be loaded, or
// it's still loading.
import { NavLink } from "react-router";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { detailsStyles as styles } from "./styles";

// "signin": the server wants a sign in (none, or it expired); "gone": signed
// in, but it's deleted or someone else's; "network": no answer
export type LoadError = "signin" | "gone" | "network";

export function LoadFailed({
  error,
  onRetry,
}: {
  error: LoadError;
  onRetry: () => void;
}) {
  if (error === "network") {
    return (
      <div className={styles.errorState} role="alert">
        <h1>Couldn't reach the shelf.</h1>
        <p>The server didn't answer. Check your connection and try again.</p>
        <div className={styles.errorActions}>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
          <NavLink to="/shelf" className="btn btn-ghost" viewTransition>
            Back to the shelf
          </NavLink>
        </div>
      </div>
    );
  }
  if (error === "gone") {
    return (
      <div className={styles.errorState}>
        <h1>This one's not on your shelf.</h1>
        <p>It might have been deleted, or the link is to someone else's.</p>
        <div className={styles.errorActions}>
          <NavLink to="/shelf" className="btn btn-primary" viewTransition>
            Back to the shelf
          </NavLink>
          <NavLink to="/add" className="btn btn-ghost" viewTransition>
            Add a series
          </NavLink>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.errorState}>
      <h1>Sign in to see this one.</h1>
      <p>Your shelf is only yours, so this needs you signed in.</p>
      <div className={styles.errorActions}>
        <NavLink to="/signin" className="btn btn-primary" viewTransition>
          Sign in
        </NavLink>
        <NavLink to="/" className="btn btn-ghost" viewTransition>
          Home
        </NavLink>
      </div>
    </div>
  );
}

export function DetailsSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true" aria-label="Loading">
      <SlowLoadQuote />
      <div className={styles.main}>
        <div className={styles.head}>
          <div className="skeleton" style={{ width: "60%", height: 44 }} />
          <div className="skeleton" style={{ width: 160, height: 24 }} />
        </div>
        <div className={styles.body}>
          <div className="skeleton" style={{ width: "100%", height: 110 }} />
        </div>
      </div>
      <div className={styles.side}>
        <div className={`skeleton ${styles.cover}`} />
      </div>
    </div>
  );
}

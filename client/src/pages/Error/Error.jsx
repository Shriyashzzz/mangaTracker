import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import styles from "./Error.module.css";
import Mascot from "../../components/mascot/Mascot";
import "../../App.css";
import { usePrivatePage } from "../../lib/seo";

function ErrorPage({ message }) {
  usePrivatePage("Oops");
  const error = useRouteError();
  const is404 = !error || (isRouteErrorResponse(error) && error.status === 404);

  return (
    <section className={styles.errorSection}>
      <span className="printed mascot-spot" aria-hidden>
        <Mascot mood={is404 ? "confused" : "panic"} />
      </span>
      <span className={styles.code}>{is404 ? "404" : "Oops"}</span>
      <h1>{is404 ? "This page wandered off" : "Something broke"}</h1>
      <p>
        {message ||
          (is404
            ? "The page you are trying to find does not exist. Maybe it's still being drawn."
            : "An unexpected error happened. Try again in a moment.")}
      </p>
      <Link className="btn btn-primary btn-lg" to="/">
        Go back home
      </Link>
    </section>
  );
}

export default ErrorPage;

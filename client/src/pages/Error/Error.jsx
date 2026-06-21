import { Link } from "react-router";
import styles from "./Error.module.css";

function ErrorPage({
  message = "404 Not Found: The page you are trying to search for does not exist",
}) {
  return (
    <>
      <section className={styles.errorSection}>
        <h2>{message}</h2>
        {message == "Error Fetching API Data" ? (
          ""
        ) : (
          <Link className={styles.goBackLink} to="/">
            Go back Home
          </Link>
        )}
      </section>
    </>
  );
}

export default ErrorPage;

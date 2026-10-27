import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import Mascot from "../../components/mascot/Mascot";
import "../../index.css";
import { usePrivatePage } from "../../lib/seo";

function ErrorPage({ message }: { message?: string }) {
  usePrivatePage("Oops");
  const error = useRouteError();
  const is404 = !error || (isRouteErrorResponse(error) && error.status === 404);

  return (
    <section className="px-gutter flex min-h-dvh flex-col items-center justify-center gap-4 py-8 text-center">
      <span className="printed mascot-spot" aria-hidden>
        <Mascot mood={is404 ? "confused" : "panic"} />
      </span>
      <span className="-rotate-4 font-brand text-[clamp(6rem,22vw,10rem)] leading-[0.9] tracking-[0.04em] text-accent [-webkit-text-stroke:2px_var(--ink)] [text-shadow:6px_6px_0_var(--ink)]">{is404 ? "404" : "Oops"}</span>
      <h1 className="text-[clamp(1.8rem,4vw,2.4rem)] font-medium">{is404 ? "This page wandered off" : "Something broke"}</h1>
      <p className="mb-4 max-w-md text-ink-soft">
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

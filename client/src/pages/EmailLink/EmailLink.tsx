// The page a link in one of our emails opens (/email/confirm/:code and
// /email/unsubscribe/:code). Nobody has to be signed in: the code in the
// link says whose it is.
//
// Confirming happens as the page opens: pressing the link was the yes.
// Unsubscribing waits for one press here, so a mail scanner that opens
// every link in an inbox can't switch someone's email off.
import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router";
import Spread from "../../components/authArt/Spread";
import { apiFetch } from "../../lib/api";
import { usePrivatePage } from "../../lib/seo";
import { authStyles as styles } from "../../styles/auth";

// the server's answer for a code nobody has (an old link)
const NO_SUCH_LINK = 404;

// asking: about to ask, or asking now; done; gone: the link is no good;
// unreachable: the server didn't answer
type Stage = "ready" | "asking" | "done" | "gone" | "unreachable";

export default function EmailLink({
  action,
}: {
  action: "confirm" | "unsubscribe";
}) {
  const { code = "" } = useParams();
  const confirming = action === "confirm";
  usePrivatePage(confirming ? "Confirm your email" : "Unsubscribe");
  const [stage, setStage] = useState<Stage>(confirming ? "asking" : "ready");
  // counts the tries, so "Try again" asks once more
  const [tries, setTries] = useState(0);

  const ask = (signal?: AbortSignal) =>
    apiFetch(`/api/email/${action}/${encodeURIComponent(code)}`, {
      method: "POST",
      signal,
    })
      .then((result) => {
        if (result.ok) setStage("done");
        else setStage(result.status === NO_SUCH_LINK ? "gone" : "unreachable");
      })
      .catch(() => {
        if (!signal?.aborted) setStage("unreachable");
      });

  // a confirm link is answered as the page opens
  useEffect(() => {
    if (!confirming) return;
    const stop = new AbortController();
    void ask(stop.signal);
    return () => stop.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirming, code, tries]);

  if (stage === "gone")
    return (
      <Spread
        sfx="Too late!"
        line="A new email address gets new links."
        title="Link ran out"
      >
        <p className={styles.lead}>
          This link doesn't work any more. The weekly email is switched on and
          off in your settings.
        </p>
        <ToSettings primary />
      </Spread>
    );

  if (stage === "unreachable")
    return (
      <Spread
        sfx="Hold on!"
        line="Your link is fine. We just couldn't use it."
        title="Couldn't reach us"
      >
        <p className={styles.lead}>
          We couldn't reach Manga Tracker. Nothing has changed yet.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => {
            setStage("asking");
            if (confirming) setTries((n) => n + 1);
            else void ask();
          }}
        >
          Try again
        </button>
      </Spread>
    );

  if (confirming)
    return stage === "done" ? (
      <Spread
        sfx="You're in!"
        line="We only write when there's news."
        title="Email confirmed"
      >
        <p className={styles.lead}>
          Your weekly email is on. It comes when a volume for your shelf is out,
          or a price drops on your To buy list.
        </p>
        <ToTheShelf />
      </Spread>
    ) : (
      <Spread sfx="One sec!" line="Checking your link." title="Confirming…">
        <p className={styles.lead} aria-busy>
          Checking your link.
        </p>
      </Spread>
    );

  return stage === "done" ? (
    <Spread
      sfx="Done!"
      line="Your shelf stays right where it is."
      title="Unsubscribed"
    >
      <p className={styles.lead}>
        You won't get the weekly email any more. Your account and your shelf are
        untouched.
      </p>
      <ToSettings />
    </Spread>
  ) : (
    <Spread
      sfx="Leaving?"
      line="One press and the emails stop."
      title="Stop the weekly email?"
    >
      <p className={styles.lead}>
        You'll stop getting news about your shelf by email. Nothing else
        changes.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        disabled={stage === "asking"}
        onClick={() => {
          setStage("asking");
          void ask();
        }}
      >
        {stage === "asking" ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      <p className={styles.switchRow}>
        Changed your mind?{" "}
        <NavLink to="/shelf" viewTransition>
          Keep getting it
        </NavLink>
      </p>
    </Spread>
  );
}

const ToTheShelf = () => (
  <NavLink
    to="/shelf"
    viewTransition
    className="btn btn-primary btn-lg btn-block"
  >
    Open my shelf
  </NavLink>
);

// "Changed your mind?" after unsubscribing; the way on for a dead link
const ToSettings = ({ primary = false }: { primary?: boolean }) =>
  primary ? (
    <NavLink
      to="/settings/new-releases"
      viewTransition
      className="btn btn-primary btn-lg btn-block"
    >
      Open settings
    </NavLink>
  ) : (
    <p className={styles.switchRow}>
      Changed your mind? Switch it back on in{" "}
      <NavLink to="/settings/new-releases" viewTransition>
        Settings
      </NavLink>
    </p>
  );

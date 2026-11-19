// The page a reset email's link opens (/reset-password/:token): checks the
// link still works, then takes the new password. A link that ran out or was
// used says so, and offers a new one.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, useParams } from "react-router";
import Spread from "../../components/authArt/Spread";
import PasswordInput from "../../components/passwordInput/PasswordInput";
import { apiFetch, errorMessages } from "../../lib/api";
import { NEW_PASSWORD_MIN } from "../../lib/passwordRule";
import { usePrivatePage } from "../../lib/seo";
import { authStyles as styles } from "../../styles/auth";
import { orOffline } from "../../lib/offline";

// the server's answer for a link that is unknown, used, or out of time
const LINK_GONE = 410;

// checking: asking the server about the link; ready: the form;
// gone: the link is no good; unreachable: the server didn't answer
type Stage = "checking" | "ready" | "gone" | "unreachable" | "done";

export default function ResetPassword() {
  usePrivatePage("New password");
  const { token = "" } = useParams();
  const passRef = useRef<HTMLInputElement>(null);
  const againRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("checking");
  // counts the checks, so "Try again" asks the server once more
  const [checks, setChecks] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // which box the error is about, so it gets the outline
  const [wrongBox, setWrongBox] = useState<"password" | "again" | null>(null);

  useEffect(() => {
    const stop = new AbortController();
    apiFetch(`/api/auth/verifytoken/${encodeURIComponent(token)}`, {
      signal: stop.signal,
    })
      .then((result) => {
        if (result.ok) setStage("ready");
        else setStage(result.status === LINK_GONE ? "gone" : "unreachable");
      })
      .catch(() => {
        if (!stop.signal.aborted) setStage("unreachable");
      });
    return () => stop.abort();
  }, [token, checks]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setWrongBox(null);
    const password = passRef.current?.value ?? "";
    const again = againRef.current?.value ?? "";

    // the server's own rules, said here first
    const refuse = (box: "password" | "again", message: string) => {
      setWrongBox(box);
      setError(message);
    };
    if (password.length < NEW_PASSWORD_MIN)
      return refuse(
        "password",
        `Passwords need at least ${NEW_PASSWORD_MIN} characters.`,
      );
    if (!password.trim())
      return refuse("password", "A password needs more than spaces.");
    if (password !== again)
      return refuse("again", "The two passwords don't match.");

    setSaving(true);
    try {
      const result = await apiFetch(
        `/api/auth/resetPassword/${encodeURIComponent(token)}`,
        {
          method: "POST",
          body: { newPassword: password, confirmPassword: again },
        },
      );
      if (result.ok) setStage("done");
      else if (result.status === LINK_GONE) setStage("gone");
      else setError((await errorMessages(result))[0]);
    } catch {
      setError(orOffline("We couldn't save it. Try again in a minute."));
    } finally {
      setSaving(false);
    }
  };

  if (stage === "done")
    return (
      <Spread
        sfx="You're back!"
        chapter="374"
        line="Your shelf is right where you left it."
        title="Password changed"
      >
        <p className={styles.lead}>
          Your new password is saved. Other devices were signed out, to be safe.
        </p>
        <NavLink
          to="/signin"
          viewTransition
          className="btn btn-primary btn-lg btn-block"
        >
          Sign in
        </NavLink>
      </Spread>
    );

  if (stage === "gone")
    return (
      <Spread
        sfx="Too late!"
        line="Reset links only last 15 minutes, and work once."
        title="Link ran out"
      >
        <p className={styles.lead}>
          This reset link has run out or was already used. Your password hasn't
          changed.
        </p>
        <NavLink
          to="/forgot-password"
          viewTransition
          className="btn btn-primary btn-lg btn-block"
        >
          Send a new link
        </NavLink>
        <BackToSignIn />
      </Spread>
    );

  if (stage === "unreachable")
    return (
      <Spread
        sfx="Hold on!"
        line="Your link is fine. We just couldn't check it."
        title="Couldn't check"
      >
        <p className={styles.lead}>
          We couldn't reach the site to check your link. Your password hasn't
          changed.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => {
            setStage("checking");
            setChecks((n) => n + 1);
          }}
        >
          Try again
        </button>
        <BackToSignIn />
      </Spread>
    );

  return (
    <Spread
      sfx="New page!"
      line="Pick a password you'll remember this time."
      title="New password"
    >
      <form
        onSubmit={handleSubmit}
        className={styles.fields}
        noValidate
        aria-busy={stage === "checking"}
      >
        <div className={styles.field}>
          <label htmlFor="new-password">New password</label>
          <PasswordInput
            id="new-password"
            ref={passRef}
            name="new-password"
            autoComplete="new-password"
            aria-invalid={wrongBox === "password"}
            aria-describedby="new-password-hint"
          />
          <span id="new-password-hint" className={styles.hint}>
            At least {NEW_PASSWORD_MIN} characters.
          </span>
        </div>
        <div className={styles.field}>
          <label htmlFor="new-password-again">Type it again</label>
          <PasswordInput
            id="new-password-again"
            ref={againRef}
            name="new-password-again"
            autoComplete="new-password"
            aria-invalid={wrongBox === "again"}
          />
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className={`btn btn-primary btn-lg btn-block ${styles.submit}`}
          disabled={saving || stage === "checking"}
        >
          {stage === "checking"
            ? "Checking your link…"
            : saving
              ? "Saving…"
              : "Save new password"}
        </button>
      </form>
    </Spread>
  );
}

const BackToSignIn = () => (
  <p className={styles.switchRow}>
    Back to{" "}
    <NavLink to="/signin" viewTransition>
      Sign in
    </NavLink>
  </p>
);

// Forgot password: asks for the account's recovery email and has a reset
// link sent to it. The answer is the same whether or not the email has an
// account, so the page never says which.
import { useState, type FormEvent } from "react";
import { NavLink } from "react-router";
import { isMobile } from "react-device-detect";
import AuthArt from "../../components/authArt/AuthArt";
import { apiFetch, errorMessages } from "../../lib/api";
import { hasBottomBar } from "../../lib/bottomBar";
import { usePrivatePage } from "../../lib/seo";
import { authStyles as styles } from "../../styles/auth";

export default function ForgotPassword() {
  usePrivatePage("Forgot password");
  const [email, setEmail] = useState("");
  // the address a link was sent to, once one was
  const [sentTo, setSentTo] = useState("");
  const [sentAgain, setSentAgain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // true when the server took the request
  const send = async (address: string) => {
    setError("");
    setLoading(true);
    try {
      const result = await apiFetch("/api/auth/initiatePassReset", {
        method: "POST",
        body: { email: address },
      });
      if (result.ok) return true;
      setError((await errorMessages(result))[0]);
    } catch {
      setError("We couldn't send it. Try again in a minute.");
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) {
      setError("Enter your recovery email.");
      return;
    }
    if (await send(address)) setSentTo(address);
  };

  if (sentTo)
    return (
      <div className={styles.container}>
        <div className={`${styles.spread} fade-in`}>
          <AuthArt
            sfx="Sent!"
            line="Check your inbox. The link works for 15 minutes."
          />
          <div className={styles.card}>
            <h1 className={styles.title}>Check your inbox</h1>
            <p className={styles.lead}>
              If <strong>{sentTo}</strong> is an account's recovery email, a
              reset link is on its way.
            </p>
            <ul className={styles.notes}>
              <li>The link works for 15 minutes.</li>
              <li>Nothing there? Look in spam.</li>
            </ul>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className={`btn btn-ghost btn-block ${styles.submit}`}
              disabled={loading}
              onClick={async () => setSentAgain(await send(sentTo))}
            >
              {loading ? "Sending…" : "Send it again"}
            </button>
            <p className={styles.sentAgain} role="status">
              {sentAgain && !loading && "Sent again."}
            </p>
            <p className={styles.switchRow}>
              Back to{" "}
              <NavLink to="/signin" viewTransition>
                Sign in
              </NavLink>
            </p>
          </div>
        </div>
      </div>
    );

  return (
    <div className={styles.container}>
      <div className={`${styles.spread} fade-in`}>
        <AuthArt
          sfx="Lost it?"
          line="It happens to every hero. We'll send you a way back in."
        />
        <div className={styles.card}>
          <h1 className={styles.title}>Forgot password</h1>
          <p className={styles.lead}>
            Enter your recovery email. We'll send a link to choose a new
            password.
          </p>
          <form onSubmit={handleSubmit} className={styles.fields} noValidate>
            <div className={styles.field}>
              <label htmlFor="email">Recovery email</label>
              <input
                className={styles.input}
                id="email"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby="email-hint"
                autoFocus={!isMobile && !hasBottomBar()}
              />
              <span id="email-hint" className={styles.hint}>
                The one you saved in Settings, under Account.
              </span>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className={`btn btn-primary btn-lg btn-block ${styles.submit}`}
              disabled={loading}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
          <p className={styles.switchRow}>
            Remembered it?{" "}
            <NavLink to="/signin" viewTransition>
              Sign in
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}

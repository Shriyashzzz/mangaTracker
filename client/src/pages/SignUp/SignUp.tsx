import { useRef, useState, type FormEvent } from "react";
import { addPicksToShelf } from "../../lib/sharePicks";
import { isMobile } from "react-device-detect";
import { hasBottomBar } from "../../lib/bottomBar";
import { authStyles as styles } from "../../styles/auth";
import { Navigate, NavLink, useNavigate, useSearchParams } from "react-router";
import PasswordInput from "../../components/passwordInput/PasswordInput";
import AuthArt from "../../components/authArt/AuthArt";
import { apiFetch, afterSignIn, errorMessages } from "../../lib/api";
import { offerTour } from "../../lib/tourOffer";
import { usePrivatePage } from "../../lib/seo";
import { useAuth } from "../../store/auth";

// the server's rule for a new account's password (authController.ts); a
// server test fails if the two differ
const NEW_PASSWORD_MIN = 8;

export default function SignUp() {
  usePrivatePage("Create account");
  const navigater = useNavigate();
  const [params] = useSearchParams();
  const userNameRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const signedIn = useAuth((s) => s.signedIn);
  const [loading, setLoading] = useState(false);
  // already signed in when they got here: this page has nothing for them
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [justJoined, setJustJoined] = useState(false);
  const [errors, setErrors] = useState<{ msg: string }[]>([]);
  // the password was too short at the last try: its hint says so
  const [passwordShort, setPasswordShort] = useState(false);
  // the server's messages name the field they're about
  const hasError = (about: RegExp) => errors.some((e) => about.test(e.msg));
  const describedBy = (hint: string) =>
    errors.length ? `${hint} signup-errors` : hint;

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors([]);

    const username = (userNameRef.current?.value ?? "").trim();
    const password = passRef.current?.value ?? "";

    if (!username || !password) {
      setErrors([{ msg: "Username and password are required." }]);
      return;
    }
    // The server's own rules (authController.ts), checked here first: a
    // slip of the finger shouldn't use up one of the hour's sign-ups
    const slips = [
      !/^[a-z0-9]+$/i.test(username) &&
        "Usernames are letters and numbers only.",
      (username.length < 4 || username.length > 40) &&
        "Usernames need 4 to 40 letters or numbers.",
      password.length >= NEW_PASSWORD_MIN &&
        !password.trim() &&
        "A password needs more than spaces.",
    ].filter((slip): slip is string => Boolean(slip));
    // too short is said once, by the hint under the box turning red, not
    // again in the list below it
    const short = password.length < NEW_PASSWORD_MIN;
    setPasswordShort(short);
    if (slips.length || short) {
      setErrors(slips.map((msg) => ({ msg })));
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: { username, password },
      });

      if (result.ok) {
        // a new account: Kenji offers the tour on their shelf
        offerTour();
        setJustJoined(true);
        // series they marked "I have this" on someone's shared shelf are
        // the start of their own (lib/sharePicks.ts)
        await addPicksToShelf();
        signedIn();
        navigater(afterSignIn(params), { viewTransition: true });
      } else {
        // 400: what was wrong with the form; 409: the username is taken
        setErrors((await errorMessages(result)).map((msg) => ({ msg })));
      }
    } catch {
      setErrors([{ msg: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  if (isSignedIn && !justJoined) return <Navigate to="/shelf" replace />;

  return (
    <div className={styles.container}>
      <div className={`${styles.spread} fade-in`}>
        <AuthArt
          sfx="A new series begins!"
          chapter="1"
          line="Just a username and a password. No email, no newsletter."
        />

        <div className={styles.card}>
          <h1 className={styles.title}>Start a shelf</h1>

          <form
            onSubmit={handleFormSubmit}
            className={styles.fields}
            noValidate
          >
            <div className={styles.field}>
              <label htmlFor="username">Username</label>
              <input
                className={styles.input}
                id="username"
                ref={userNameRef}
                type="text"
                placeholder="yourusername"
                name="username"
                autoComplete="username"
                required
                aria-invalid={hasError(/name/i)}
                aria-describedby={describedBy("username-hint")}
                autoFocus={!isMobile && !hasBottomBar()}
              />
              <span id="username-hint" className={styles.hint}>
                4–40 letters or numbers
              </span>
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                ref={passRef}
                name="password"
                autoComplete="new-password"
                required
                // long enough now: the red hint goes as they type
                onChange={(e) => {
                  if (e.target.value.length >= NEW_PASSWORD_MIN)
                    setPasswordShort(false);
                }}
                aria-invalid={passwordShort || hasError(/password|secret/i)}
                aria-describedby={describedBy("password-hint")}
              />
              <span
                id="password-hint"
                className={passwordShort ? styles.hintError : styles.hint}
                role={passwordShort ? "alert" : undefined}
              >
                At least {NEW_PASSWORD_MIN} characters.
              </span>
            </div>

            {errors.length > 0 && (
              <ul id="signup-errors" className={styles.errorList} role="alert">
                {errors.map((e, i) => (
                  <li key={i}>{e.msg}</li>
                ))}
              </ul>
            )}

            <button
              type="submit"
              className={`btn btn-primary btn-lg btn-block ${styles.submit}`}
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className={styles.switchRow}>
            Already have an account?{" "}
            <NavLink to={`/signin?${params}`} viewTransition>
              Sign in
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}

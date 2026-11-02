import { useRef, useState, type FormEvent } from "react";
import { authStyles as styles } from "../../styles/auth";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import PasswordInput from "../../components/passwordInput/PasswordInput";
import AuthArt from "../../components/authArt/AuthArt";
import { apiFetch, afterSignIn, errorMessages } from "../../lib/api";
import { usePrivatePage } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { isMobile } from "react-device-detect";
import { hasBottomBar } from "../../lib/bottomBar";

export default function SignInPage() {
  usePrivatePage("Sign in");
  const navigater = useNavigate();
  const [params] = useSearchParams();
  const userNameRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const signedIn = useAuth((s) => s.signedIn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const username = (userNameRef.current?.value ?? "").trim();
    const password = passRef.current?.value ?? "";

    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { username: username, password: password },
      });

      if (result.status === 200) {
        signedIn();
        navigater(afterSignIn(params), { viewTransition: true });
      } else if (result.status === 400) {
        setError((await errorMessages(result))[0] ?? "Check your details.");
      } else if (result.status === 401 || result.status === 404) {
        setError("Incorrect username or password. Try again.");
      } else {
        // there's no password reset, so never let an outage look like a lost account
        setError("We couldn't reach your shelf. Your account is fine, try again in a minute.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.spread} fade-in`}>
        <AuthArt
          sfx="Welcome back!"
          chapter="374"
          line="Your shelf is right where you left it."
        />

        <div className={styles.card}>
          <h1 className={styles.title}>Sign in</h1>

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
                placeholder="your_username"
                name="username"
                autoComplete="username"
                autoFocus={!isMobile && !hasBottomBar()}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                ref={passRef}
                placeholder="••••••••"
                name="password"
                autoComplete="current-password"
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
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className={styles.switchRow}>
            Don't have an account?{" "}
            <NavLink to={`/signup?${params}`} viewTransition>
              Sign up
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}

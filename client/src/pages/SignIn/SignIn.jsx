import { useRef, useState } from "react";
import styles from "../../styles/Auth.module.css";
import {
  NavLink,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router";
import PasswordInput from "../../components/passwordInput/PasswordInput";
import AuthArt from "../../components/authArt/AuthArt";
import { apiFetch, afterSignIn } from "../../lib/api";
import { usePrivatePage } from "../../lib/seo";

export default function SignInPage() {
  usePrivatePage("Sign in");
  const navigater = useNavigate();
  const [params] = useSearchParams();
  const userNameRef = useRef(null);
  const passRef = useRef(null);
  const [, setIsSignedIn] = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const username = userNameRef.current.value.trim();
    const password = passRef.current.value;

    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch("/login", {
        method: "POST",
        body: { username: username, password: password },
      });

      if (result.status === 200) {
        setIsSignedIn(true);
        navigater(afterSignIn(params), { viewTransition: true });
      } else {
        setError("Incorrect username or password. Try again.");
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
          <h1 className={styles.title}>Log in</h1>

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
                autoFocus
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
              {loading ? "Logging in…" : "Log in"}
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

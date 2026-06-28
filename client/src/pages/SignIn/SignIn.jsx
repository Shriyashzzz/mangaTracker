import { useRef, useState } from "react";
import styles from "./SignIn.module.css";
import { NavLink, useNavigate, useOutletContext } from "react-router";

export default function SignInPage() {
  const navigater = useNavigate();
  const userNameRef = useRef(null);
  const passRef = useRef(null);
  const [isSignedIn, setIsSignedIn] = useOutletContext();
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
      const result = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password }),
      });

      if (result.status === 200) {
        setIsSignedIn(true);
        navigater("/home", { viewTransition: true });
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
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Welcome back</span>
          <h1 className={styles.title}>
            Sign <span className={styles.accent}>In</span>
          </h1>
        </div>

        <form onSubmit={handleFormSubmit} className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              ref={userNameRef}
              type="text"
              placeholder="your_username"
              name="username"
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              ref={passRef}
              type="password"
              placeholder="••••••••"
              name="password"
              autoComplete="current-password"
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={loading}
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <div className={styles.signupRow}>
          <p>Don't have an account?</p>
          <NavLink to="/signup" viewTransition>
            <button className={styles.btnGhost}>Sign up</button>
          </NavLink>
        </div>
      </div>
    </div>
  );
}

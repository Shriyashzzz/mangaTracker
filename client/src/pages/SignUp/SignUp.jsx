import { useRef, useState } from "react";
import styles from "./SignUp.module.css";
import { NavLink, useNavigate, useOutletContext } from "react-router";

export default function SignUp() {
  const navigater = useNavigate();
  const userNameRef = useRef(null);
  const passRef = useRef(null);
  const [isSignedIn, setIsSignedIn] = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);

    const username = userNameRef.current.value.trim();
    const password = passRef.current.value;

    if (!username || !password) {
      setErrors([{ msg: "Username and password are required." }]);
      return;
    }

    setLoading(true);
    try {
      const result = await fetch(`${import.meta.env.VITE_API_URL}/signup`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (result.ok) {
        setIsSignedIn(true);
        navigater("/home", { viewTransition: true });
      } else {
        const data = await result.json();
        setErrors(data.errors || [{ msg: "Something went wrong. Try again." }]);
      }
    } catch {
      setErrors([{ msg: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Join the list</span>
          <h1 className={styles.title}>
            Sign <span className={styles.accent}>Up</span>
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
              autoComplete="new-password"
            />
            <span className={styles.hint}>Min 5 characters</span>
          </div>

          {errors.length > 0 && (
            <ul className={styles.errorList}>
              {errors.map((e, i) => (
                <li key={i}>{e.msg}</li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <div className={styles.signinRow}>
          <p>Already have an account?</p>
          <NavLink to="/signin" viewTransition>
            <button className={styles.btnGhost}>Log in</button>
          </NavLink>
        </div>
      </div>
    </div>
  );
}

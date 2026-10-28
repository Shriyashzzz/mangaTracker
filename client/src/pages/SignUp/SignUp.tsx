import { useRef, useState, type FormEvent } from "react";
import { isMobile } from "react-device-detect";
import { authStyles as styles } from "../../styles/auth";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import PasswordInput from "../../components/passwordInput/PasswordInput";
import AuthArt from "../../components/authArt/AuthArt";
import { apiFetch, afterSignIn, errorMessages } from "../../lib/api";
import { usePrivatePage } from "../../lib/seo";
import { useAuth } from "../../store/auth";

export default function SignUp() {
  usePrivatePage("Create account");
  const navigater = useNavigate();
  const [params] = useSearchParams();
  const userNameRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const signedIn = useAuth((s) => s.signedIn);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ msg: string }[]>([]);

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors([]);

    const username = (userNameRef.current?.value ?? "").trim();
    const password = passRef.current?.value ?? "";

    if (!username || !password) {
      setErrors([{ msg: "Username and password are required." }]);
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: { username, password },
      });

      if (result.ok) {
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
                placeholder="your_username"
                name="username"
                autoComplete="username"
                autoFocus={isMobile ? false : true}
              />
              <span className={styles.hint}>4–40 letters or numbers</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                ref={passRef}
                placeholder="••••••••"
                name="password"
                autoComplete="new-password"
              />
              <span className={styles.hint}>At least 5 characters</span>
            </div>

            {errors.length > 0 && (
              <ul className={styles.errorList} role="alert">
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
              Log in
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}

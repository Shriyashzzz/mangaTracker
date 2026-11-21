// Settings, Account: how they sign in. Signing in with Google too (Google's
// own button, lib/googleSignIn.ts), and for an account made with Google,
// setting a first password so their username signs in as well. Changing a
// password once set stays with the reset email
import { useState, type FormEvent } from "react";
import GoogleButton from "../../components/googleButton/GoogleButton";
import PasswordInput from "../../components/passwordInput/PasswordInput";
import type { Account } from "../../lib/account";
import { isDemo } from "../../lib/demo";
import { useAccount } from "../../store/account";
import { settingsStyles as styles } from "./styles";

type Note = { text: string; failed?: boolean } | null;

export function SignInSection({ account }: { account: Account }) {
  const linkGoogle = useAccount((s) => s.linkGoogle);
  const firstPassword = useAccount((s) => s.firstPassword);
  const [googleNote, setGoogleNote] = useState<Note>(null);
  const [password, setPassword] = useState("");
  const [passwordNote, setPasswordNote] = useState<Note>(null);
  const [saving, setSaving] = useState(false);

  const link = async (credential: string) => {
    setGoogleNote(null);
    try {
      await linkGoogle(credential);
      setGoogleNote({ text: "Done." });
    } catch (error) {
      setGoogleNote({ text: (error as Error).message, failed: true });
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordNote(null);
    setSaving(true);
    try {
      await firstPassword(password);
      setPassword("");
      setPasswordNote({ text: "Saved." });
    } catch (error) {
      setPasswordNote({ text: (error as Error).message, failed: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="set-sign-in">
      <h3 id="set-sign-in" className={styles.heading}>
        Signing in
      </h3>
      {/* the practice account's answers are made up: no Google there */}
      {isDemo() ? (
        <p className={styles.body}>Your own account can sign in with Google.</p>
      ) : account.google ? (
        <p className={styles.body}>You can sign in with Google.</p>
      ) : (
        <>
          <p className={styles.body}>
            Sign in with Google next time, in one tap.
          </p>
          <GoogleButton text="signin_with" onCredential={link} align="start" />
        </>
      )}
      {googleNote && (
        <p
          className={googleNote.failed ? styles.failed : styles.saved}
          role="status"
        >
          {googleNote.text}
        </p>
      )}

      {/* made with Google: no password yet */}
      {!account.hasPassword && (
        <form className={styles.field} onSubmit={savePassword} noValidate>
          <label htmlFor="first-password">
            Add a password, so {account.username} signs in too
          </label>
          <PasswordInput
            id="first-password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className={styles.actions}>
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={saving || !password}
            >
              Save password
            </button>
            <span
              className={passwordNote?.failed ? styles.failed : styles.saved}
              role="status"
            >
              {passwordNote?.text}
            </span>
          </div>
        </form>
      )}
    </section>
  );
}

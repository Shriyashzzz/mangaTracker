// What other people see, if they share their list: a name and a picture. The
// username stays out of it, since it's half of how they sign in.
import { useEffect, useState, type FormEvent } from "react";
import { NavLink, useNavigate } from "react-router";
import Avatar from "../../components/avatar/Avatar";
import Mascot from "../../components/mascot/Mascot";
import { getAccount, saveAccount, shareUrl, type Account } from "../../lib/account";
import { signInPath } from "../../lib/api";
import { AVATARS, DEFAULT_AVATAR } from "../../lib/avatars";
import { usePrivatePage } from "../../lib/seo";
import { useAuth } from "../../store/auth";
import { settingsStyles as styles } from "../Settings/styles";

export default function ProfilePage() {
  usePrivatePage("Profile");
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState<{ text: string; failed?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isSignedIn === false) navigate(signInPath("/profile"), { replace: true });
    if (!isSignedIn) return;
    const controller = new AbortController();
    getAccount(controller.signal)
      .then((found) => {
        setAccount(found);
        setName(found.displayName ?? "");
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoadFailed(true);
      });
    return () => controller.abort();
  }, [isSignedIn, navigate]);

  if (loadFailed) {
    return (
      <div className={styles.page} role="alert">
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="panic" />
        </span>
        <p className={styles.body}>Couldn't load your profile. Refresh to try again.</p>
      </div>
    );
  }
  if (!account) {
    return <div className={`skeleton ${styles.page} min-h-96`} aria-busy="true" aria-label="Loading" />;
  }

  const save = async (patch: Parameters<typeof saveAccount>[0], saved = "Saved.") => {
    setNote(null);
    try {
      setAccount(await saveAccount(patch));
      setNote({ text: saved });
    } catch (e) {
      setNote({ text: (e as Error).message, failed: true });
    }
  };

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    save({ displayName: name.trim() || null });
  };

  const copyLink = async () => {
    if (!account.shareCode) return;
    try {
      await navigator.clipboard.writeText(shareUrl(account.shareCode));
      setCopied(true);
    } catch {
      setNote({ text: "Couldn't copy that. Select the link instead.", failed: true });
    }
  };

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <Avatar id={account.avatar} className={styles.headArt} />
        <h1 className={styles.title}>{account.displayName || "Your profile"}</h1>
      </header>

      <p className={note?.failed ? styles.failed : styles.saved} role="status">
        {note?.text}
      </p>

      <section className={styles.section} aria-labelledby="profile-name">
        <h2 id="profile-name" className={styles.heading}>
          Your name
        </h2>
        <form className={styles.field} onSubmit={saveName}>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            className={styles.input}
            value={name}
            maxLength={40}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
          <p className={styles.body}>
            Shown if you share your list. Your username stays private.
          </p>
          <div className={styles.actions}>
            <button type="submit" className="btn btn-secondary">
              Save name
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section} aria-labelledby="profile-picture">
        <h2 id="profile-picture" className={styles.heading}>
          Your picture
        </h2>
        <div className={styles.pictures} role="radiogroup" aria-labelledby="profile-picture">
          {AVATARS.map((avatar) => (
            <label key={avatar.id} className={styles.picture}>
              <input
                type="radio"
                name="avatar"
                checked={(account.avatar ?? DEFAULT_AVATAR) === avatar.id}
                onChange={() => save({ avatar: avatar.id })}
              />
              <Avatar id={avatar.id} className={styles.pictureArt} />
              {avatar.label}
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="profile-share">
        <h2 id="profile-share" className={styles.heading}>
          Share your list
        </h2>
        <p className={styles.body}>
          Anyone with the link can see your name, picture, and each series with
          its chapter and rating. Search engines are asked to stay away.
        </p>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={account.shareEnabled}
            onChange={(e) => {
              setCopied(false);
              save(
                { shareEnabled: e.target.checked },
                e.target.checked ? "Your list is shared." : "Your list is private again.",
              );
            }}
          />
          Share my list
        </label>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={account.shareNotes}
            disabled={!account.shareEnabled}
            onChange={(e) => save({ shareNotes: e.target.checked })}
          />
          Include my notes
        </label>
        {account.shareEnabled && account.shareCode && (
          <div className={styles.shareLink}>
            <span className={styles.shareUrl}>{shareUrl(account.shareCode)}</span>
            <button type="button" className="btn btn-secondary" onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <NavLink to={`/u/${account.shareCode}`} className={styles.link} viewTransition>
              See it
            </NavLink>
          </div>
        )}
      </section>
    </article>
  );
}

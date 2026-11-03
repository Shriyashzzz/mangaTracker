// What other people see, if they share their list: a name and a picture. The
// username stays out of it, since it's half of how they sign in.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, useLocation } from "react-router";
import Avatar from "../../components/avatar/Avatar";
import { shareUrl, type Account } from "../../lib/account";
import { AVATARS, AVATARS_SHOWN_FIRST, DEFAULT_AVATAR } from "../../lib/content/avatars";
import { useAccount } from "../../store/account";
import { settingsStyles as styles } from "./styles";

// beside the control it's about, so nobody has to scroll to learn if it worked
type Note = { where: "name" | "picture" | "share"; text: string; failed?: boolean };

export default function ProfileTab({ account }: { account: Account }) {
  const saveAccount = useAccount((s) => s.save);
  const [name, setName] = useState(account.displayName ?? "");
  const [note, setNote] = useState<Note | null>(null);
  const [copied, setCopied] = useState(false);
  const [allPictures, setAllPictures] = useState(false);
  const shareSection = useRef<HTMLElement>(null);
  const { hash } = useLocation();

  // from "Share" on the shelf or in the menu
  useEffect(() => {
    if (hash === "#share") shareSection.current?.scrollIntoView({ block: "start" });
  }, [hash]);

  const save = async (
    where: Note["where"],
    patch: Parameters<typeof saveAccount>[0],
    saved = "Saved.",
  ) => {
    setNote(null);
    try {
      await saveAccount(patch);
      setNote({ where, text: saved });
    } catch (e) {
      setNote({ where, text: (e as Error).message, failed: true });
    }
  };
  const noteFor = (where: Note["where"]) => (
    <p
      className={note?.where === where && note.failed ? styles.failed : styles.saved}
      role="status"
    >
      {note?.where === where && note.text}
    </p>
  );

  const unsavedName = name.trim() !== (account.displayName ?? "");

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    save("name", { displayName: name.trim() || null });
  };

  // fills the box so they can still change it; a different one each time
  const surpriseMe = () => {
    const others = account.nameIdeas.filter((idea) => idea !== name);
    setName(others[Math.floor(Math.random() * others.length)] ?? name);
    setNote(null);
  };

  // folded away, what they've picked still shows, in the last spot
  const chosen = account.avatar ?? DEFAULT_AVATAR;
  const firstPictures = AVATARS.slice(0, AVATARS_SHOWN_FIRST);
  const pictures = allPictures
    ? AVATARS
    : firstPictures.some((a) => a.id === chosen)
      ? firstPictures
      : [
          ...firstPictures.slice(0, -1),
          ...AVATARS.filter((a) => a.id === chosen),
        ];
  const morePictures = AVATARS.length - AVATARS_SHOWN_FIRST;

  const copyLink = async () => {
    if (!account.shareCode) return;
    try {
      await navigator.clipboard.writeText(shareUrl(account.shareCode));
      setCopied(true);
    } catch {
      setNote({
        where: "share",
        text: "Couldn't copy that. Select the link instead.",
        failed: true,
      });
    }
  };

  return (
    <div className={styles.tabBody} data-tour="profile">
      <header className={styles.head}>
        <Avatar id={account.avatar} className={styles.headArt} />
        <h2 className={styles.tabTitle}>{account.displayName || account.defaultName}</h2>
      </header>

      <section className={styles.section} aria-labelledby="profile-name">
        <h3 id="profile-name" className={styles.heading}>
          Your name
        </h3>
        <form className={styles.field} onSubmit={saveName}>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            className={styles.input}
            value={name}
            maxLength={40}
            autoComplete="nickname"
            placeholder={account.defaultName}
            onChange={(e) => {
              setName(e.target.value);
              setNote(null);
            }}
          />
          <p className={styles.body}>
            Shown if you share your list
            {!account.displayName && `, as ${account.defaultName} for now`}. Your
            username stays private.
          </p>
          <div className={styles.actions}>
            <button type="submit" className="btn btn-secondary">
              Save name
            </button>
            <button type="button" className="btn btn-ghost" onClick={surpriseMe}>
              Surprise me
            </button>
            {unsavedName && !note && <p className={styles.saved}>Not saved yet.</p>}
            {noteFor("name")}
          </div>
        </form>
      </section>

      <section
        className={styles.section}
        aria-labelledby="profile-picture"
      >
        <h3 id="profile-picture" className={styles.heading}>
          Your picture
        </h3>
        <div
          id="picture-options"
          className={styles.pictures}
          role="radiogroup"
          aria-labelledby="profile-picture"
        >
          {pictures.map((avatar) => (
            <label key={avatar.id} className={styles.picture}>
              <input
                type="radio"
                name="avatar"
                checked={chosen === avatar.id}
                onChange={() => save("picture", { avatar: avatar.id })}
              />
              <Avatar id={avatar.id} className={styles.pictureArt} />
              {avatar.label}
            </label>
          ))}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-secondary"
            aria-expanded={allPictures}
            aria-controls="picture-options"
            onClick={() => setAllPictures(!allPictures)}
          >
            {allPictures ? "Show fewer" : `Show ${morePictures} more`}
          </button>
          {noteFor("picture")}
        </div>
      </section>

      <section
        ref={shareSection}
        className={styles.section}
        aria-labelledby="profile-share"
      >
        <h3 id="profile-share" className={styles.heading}>
          Share your list
        </h3>
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
                "share",
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
            onChange={(e) =>
              save(
                "share",
                { shareNotes: e.target.checked },
                e.target.checked ? "Your notes are shared." : "Your notes are private.",
              )
            }
          />
          Include my notes
        </label>
        {noteFor("share")}
        {account.shareEnabled && account.shareCode && (
          <div className={styles.shareLink}>
            <span className={styles.shareUrl}>{shareUrl(account.shareCode)}</span>
            <button type="button" className="btn btn-secondary" onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <NavLink to={`/u/${account.shareCode}`} className={`tap ${styles.link}`} viewTransition>
              See it
            </NavLink>
          </div>
        )}
      </section>
    </div>
  );
}

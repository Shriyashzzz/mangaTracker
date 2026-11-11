// "Add to my To read" in a shared series' sheet: someone sees a series on a
// friend's shelf and keeps it for later, in one tap. Already on theirs, it
// says so and links to it; signed out, it's the way to sign in and come back
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { PlusIcon } from "../../components/icons/Icons";
import { apiFetch, signInPath } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";
import type { SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";

const sameName = (a: string) => a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export default function AddToShelf({ m }: { m: SharedManga }) {
  const { pathname, search } = useLocation();
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const shelf = useShelf((s) => s.manga);
  const loadShelf = useShelf((s) => s.load);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isSignedIn && !shelf) void loadShelf();
  }, [isSignedIn, shelf, loadShelf]);

  if (isSignedIn === false) {
    return (
      <p className={styles.addLine}>
        <NavLink
          to={signInPath(pathname + search)}
          className={styles.addLink}
          rel="nofollow"
          viewTransition
        >
          Sign in to add it to your shelf
        </NavLink>
      </p>
    );
  }
  if (!isSignedIn) return null;

  // a light novel and its manga are two series, as on their own shelf
  const onShelf = shelf?.find(
    (mine) =>
      Boolean(mine.lightNovel) === Boolean(m.lightNovel) &&
      sameName(mine.name) === sameName(m.name),
  );
  if (onShelf) {
    return (
      <p className={styles.addLine}>
        <NavLink
          to={`/details/${onShelf.id}`}
          className={styles.addLink}
          viewTransition
        >
          {onShelf.planned ? "On your To read list" : "On your shelf too"} →
        </NavLink>
      </p>
    );
  }

  const add = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/manga", {
        method: "POST",
        body: {
          name: m.name.slice(0, 150),
          status: false,
          planned: true,
          ...(m.lightNovel ? { lightNovel: true } : {}),
          ...(m.image ? { image: m.image } : {}),
          ...(m.genre && m.genre !== "unlabled" ? { genre: m.genre } : {}),
        },
      });
      // already there under another name: the reload says so
      if (!res.ok && res.status !== 409)
        throw new Error(`Add failed ${res.status}`);
      await loadShelf();
    } catch (e) {
      console.error(e);
      setError("That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <p className={styles.addLine}>
      <button
        type="button"
        className="btn btn-primary gap-2 [&_svg]:size-4"
        disabled={saving || !shelf}
        onClick={add}
      >
        {!saving && <PlusIcon />}
        {saving ? "Adding…" : "Add to my To read"}
      </button>
      {error && (
        <span className="font-medium text-accent" role="alert">
          {error}
        </span>
      )}
    </p>
  );
}

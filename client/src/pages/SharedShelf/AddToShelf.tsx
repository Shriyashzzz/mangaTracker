// "Add to my To read" in a shared series' sheet: someone sees a series on a
// friend's shelf and keeps it for later, in one tap. Already on theirs, it
// says so and links to it. Signed out, there's nothing here: a visitor
// reading about a series isn't asked to make an account (SeriesSheet shows
// "I have this" instead, to one who's comparing shelves)
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { PlusIcon } from "../../components/icons/Icons";
import { useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";
import { addToRead } from "./addToRead";
import type { SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";
import { titleKey as sameName } from "../../lib/titleKey";

export default function AddToShelf({ m }: { m: SharedManga }) {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const shelf = useShelf((s) => s.manga);
  const loadShelf = useShelf((s) => s.load);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isSignedIn && !shelf) void loadShelf();
  }, [isSignedIn, shelf, loadShelf]);

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
    const saved = await addToRead(m);
    if (saved) await loadShelf();
    else setError("That didn't save. Try again.");
    setSaving(false);
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

// "Add to my to-read" on a series' price page: saves it to their To read list
// without going through the add page. One quiet line under the series' facts.
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { apiFetch, signInPath } from "../../lib/api";
import { pickGenre } from "../../lib/anilist";
import { novelParts } from "../../lib/prices";
import { useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";

const sameName = (a: string) => a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

type Props = {
  name: string;
  altNames?: string[];
  cover: string | null;
  genres?: string[];
};

const line = "flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem]";
const link =
  "tap font-medium underline decoration-accent decoration-2 underline-offset-3";

export default function ToReadButton({
  name,
  altNames = [],
  cover,
  genres = [],
}: Props) {
  const { pathname } = useLocation();
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const shelf = useShelf((s) => s.manga);
  const loadShelf = useShelf((s) => s.load);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isSignedIn && !shelf) void loadShelf();
  }, [isSignedIn, shelf, loadShelf]);

  if (!isSignedIn) {
    return isSignedIn === false ? (
      <p className={line}>
        <NavLink
          to={signInPath(pathname)}
          className={link}
          rel="nofollow"
          viewTransition
        >
          + Add to my to-read
        </NavLink>
      </p>
    ) : null;
  }

  // a light novel's page names it "… Light Novel": it's the novel, under its
  // own name, and only the novel counts as already there
  const novel = novelParts(name);
  const names = [name, ...altNames].map((n) => sameName(novelParts(n).title));
  const onShelf = shelf?.find(
    (m) =>
      Boolean(m.lightNovel) === novel.lightNovel &&
      names.includes(sameName(m.name)),
  );
  if (onShelf) {
    return (
      <p className={line}>
        <NavLink to={`/details/${onShelf.id}`} className={link} viewTransition>
          {onShelf.planned ? "On your To read list" : "On your shelf"} →
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
          name: novel.title.slice(0, 150),
          status: false,
          planned: true,
          ...(novel.lightNovel ? { lightNovel: true } : {}),
          ...(cover ? { image: cover } : {}),
          ...(pickGenre(genres) ? { genre: pickGenre(genres) } : {}),
        },
      });
      // already there under another name: the shelf will say so once it reloads
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
    <p className={line}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={saving || !shelf}
        onClick={add}
      >
        {saving ? "Adding…" : "+ Add to my to-read"}
      </button>
      {error && (
        <span className="font-medium text-accent" role="alert">
          {error}
        </span>
      )}
    </p>
  );
}

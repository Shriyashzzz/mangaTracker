// The same series on the shelf twice (added twice before the add form warned,
// or under two lists): said on its details page, with one button that makes
// them one. The server keeps everything either had (POST /api/manga/:id/merge)
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { Manga } from "../../lib/types";
import { useShelf } from "../../store/shelf";
import { detailsStyles as styles } from "./styles";

// names compared as the shelf compares them: case and punctuation aside
const key = (name: string) =>
  name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export default function TwiceNote({ manga }: { manga: Manga }) {
  const shelf = useShelf((s) => s.manga);
  const [merging, setMerging] = useState(false);
  const [failed, setFailed] = useState(false);
  // opened straight from a link: the shelf isn't read yet, so read it
  useEffect(() => {
    if (!shelf) void useShelf.getState().load();
  }, [shelf]);
  const other = shelf?.find(
    (m) =>
      m.id !== manga.id &&
      Boolean(m.lightNovel) === Boolean(manga.lightNovel) &&
      key(m.name) === key(manga.name),
  );
  if (!other) return null;

  const merge = async () => {
    setMerging(true);
    setFailed(false);
    try {
      const res = await apiFetch(`/api/manga/${manga.id}/merge`, {
        method: "POST",
        body: { otherId: other.id },
      });
      if (!res.ok) throw new Error(`merge ${res.status}`);
      // the shelf and this page both change: read them afresh
      await useShelf.getState().load();
      window.location.reload();
    } catch {
      setFailed(true);
      setMerging(false);
    }
  };

  return (
    <p className={styles.twiceNote} role="status">
      This series is on your shelf twice.{" "}
      <button
        type="button"
        className={styles.twiceButton}
        onClick={merge}
        disabled={merging}
      >
        {merging ? "Merging…" : "Merge them"}
      </button>
      <span className={styles.twiceWhy}>
        Every volume, the further chapter, notes and rating are kept.
      </span>
      {failed && (
        <span className={styles.twiceWhy} role="alert">
          That didn't work. Try again.
        </span>
      )}
    </p>
  );
}

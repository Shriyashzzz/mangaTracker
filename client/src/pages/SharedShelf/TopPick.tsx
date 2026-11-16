// For the owner, in a series' sheet on their own shared shelf: put this
// series at the top of the shelf, or take it off. Up to five lead the page
// and the picture the link shows (server util/shelf/shareTop.ts). Saved
// with their preferences.
import { useState } from "react";
import { saveShareTop } from "../../lib/account";
import type { SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";

// the same limit as the server's MOST_TOP (server
// tests/shelf/rulesInStep.test.ts fails if they differ)
const MOST_TOP = 5;

export default function TopPick({
  m,
  top,
  onChange,
}: {
  m: SharedManga;
  // the names at the top now, in order
  top: string[];
  onChange: (top: string[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const isTop = top.includes(m.name);
  const isFull = !isTop && top.length >= MOST_TOP;

  const toggle = async () => {
    const next = isTop
      ? top.filter((name) => name !== m.name)
      : [...top, m.name];
    setSaving(true);
    setFailed(false);
    const saved = await saveShareTop(next);
    setSaving(false);
    if (saved) onChange(next);
    else setFailed(true);
  };

  return (
    <p className={styles.addLine}>
      {isFull ? (
        <span className="text-ink-soft">
          You have {MOST_TOP} top picks already. Remove one to add this.
        </span>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={toggle}
        >
          {isTop ? "Remove from my top picks" : "Add to my top picks"}
        </button>
      )}
      {failed && (
        <span className="font-medium text-accent" role="alert">
          That didn't save. Try again.
        </span>
      )}
    </p>
  );
}

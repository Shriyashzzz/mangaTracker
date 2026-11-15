// What a series is about, in a shared series' sheet: a few lines of its
// AniList synopsis, with "Read more". For a visitor who doesn't know the
// series, it's the reason to keep it for later or look at its prices.
//
// Not the owner's notes (those show only if they share them). The synopsis
// is asked for when the sheet opens, from what the price pages have saved
// (GET /api/prices/summary/series, database only): a series nobody has
// opened a price page for has none, and nothing is shown.
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { priceName } from "../../lib/prices";
import type { SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";

// shorter than this fits without folding
const LONG = 220;

async function synopsisOf(m: SharedManga, signal: AbortSignal) {
  const res = await apiFetch(
    `/api/prices/summary/series?${new URLSearchParams({ name: priceName(m) })}`,
    { signal },
  );
  // 204: nothing saved for this series
  if (res.status !== 200) return null;
  const { description } = (await res.json()) as { description?: string };
  return description?.trim() || null;
}

export default function Synopsis({ m }: { m: SharedManga }) {
  // what's been found for which series, so one series' text never shows
  // under another. `text` is null when it has no synopsis
  const [found, setFound] = useState<{
    name: string;
    text: string | null;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    synopsisOf(m, controller.signal)
      .then((text) => setFound({ name: m.name, text }))
      .catch((e: Error) => {
        // no synopsis is fine: the sheet is whole without it
        if (e.name !== "AbortError") setFound({ name: m.name, text: null });
      });
    return () => controller.abort();
  }, [m]);

  // Still asking: its room is held, as three faint lines, so the sheet
  // doesn't jump when the words arrive a moment after it opens
  if (found?.name !== m.name)
    return <div className={styles.synopsisWaiting} aria-hidden />;
  if (!found.text) return null;
  const long = found.text.length > LONG;
  return (
    <div className={styles.synopsis}>
      <p className={long && !expanded ? styles.synopsisFolded : undefined}>
        {found.text}
      </p>
      {long && (
        <button
          type="button"
          className={styles.synopsisMore}
          aria-expanded={expanded}
          onClick={() => setExpanded((now) => !now)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

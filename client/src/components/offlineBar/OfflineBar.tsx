// The strip under the header: a quiet "Offline" while offline, blended into
// the page; then, back online, how sending went. Nothing at all while everything is fresh and sent. What
// it says is worked out in offlineBarText.ts.
import { useEffect } from "react";
import { useOffline } from "../../lib/offline";
import { clearChangesNote, useOfflineChanges } from "../../lib/offlineChanges";
import { offlineBarText } from "./offlineBarText";

// how long "Saved 3 changes made offline" stays
const NOTE_MS = 6000;

const band =
  "border-b-[1.5px] border-line px-gutter py-1.5 text-center text-[0.85rem] leading-[1.4] text-balance";
const tones = {
  // the page's own paper, a shade darker, small soft lettering
  offline:
    "bg-paper-2 py-0.5 text-center text-[0.75rem] tracking-[0.04em] text-ink-soft",
  note: `${band} bg-accent-wash text-ink`,
};

export default function OfflineBar() {
  const online = useOffline((s) => s.online);
  const savedAt = useOffline((s) => s.savedAt);
  const { waiting, sending, note } = useOfflineChanges();

  useEffect(() => {
    if (!note) return;
    const gone = setTimeout(clearChangesNote, NOTE_MS);
    return () => clearTimeout(gone);
  }, [note]);

  const said = offlineBarText({ online, savedAt, waiting, sending, note });
  if (!said) return null;
  return (
    <p className={tones[said.tone]} role="status">
      {said.text}
    </p>
  );
}

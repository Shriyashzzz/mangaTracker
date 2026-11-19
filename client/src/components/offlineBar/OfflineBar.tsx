// The strip under the header that says the app is offline, how old the
// shelf on screen is, and what's waiting to be sent; then, back online,
// how sending went. Nothing at all while everything is fresh and sent. What
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
  offline: `${band} bg-ink text-paper`,
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
      {said.tone === "offline" && (
        <strong className="font-semibold">{said.lead} </strong>
      )}
      {said.text}
    </p>
  );
}

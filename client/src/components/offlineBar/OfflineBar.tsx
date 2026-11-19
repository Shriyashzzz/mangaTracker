// The strip under the header that says the app is offline, how old the
// shelf on screen is, and what's waiting to be sent; then, back online,
// how sending went. Nothing at all while everything is fresh and sent.
import { useEffect } from "react";
import { useOffline } from "../../lib/offline";
import { clearChangesNote, useOfflineChanges } from "../../lib/offlineChanges";

// how long "Saved 3 changes made offline" stays
const NOTE_MS = 6000;

const changesText = (n: number) => (n === 1 ? "1 change" : `${n} changes`);
// "2:14 pm", or "Nov 18" for a copy from another day
function keptText(savedAt: number) {
  const kept = new Date(savedAt);
  const today = new Date().toDateString() === kept.toDateString();
  return today
    ? kept.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : kept.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// the ink band while offline; a wash for how sending went
const band =
  "border-b-[1.5px] border-line px-gutter py-1.5 text-center text-[0.85rem] leading-[1.4] text-balance";
const offlineBand = `${band} bg-ink text-paper`;
const noteBand = `${band} bg-accent-wash text-ink`;

export default function OfflineBar() {
  const online = useOffline((s) => s.online);
  const savedAt = useOffline((s) => s.savedAt);
  const { waiting, sending, note } = useOfflineChanges();

  useEffect(() => {
    if (!note) return;
    const gone = setTimeout(clearChangesNote, NOTE_MS);
    return () => clearTimeout(gone);
  }, [note]);

  const offline = !online || savedAt != null;
  if (offline) {
    const shelf = savedAt
      ? `Your shelf as of ${keptText(savedAt)}.`
      : "Chapters and volumes you change save when you're back.";
    const changes = waiting
      ? ` ${changesText(waiting)} will save when you're back.`
      : "";
    return (
      <p className={offlineBand} role="status">
        <strong className="font-semibold">Offline.</strong> {shelf}
        {changes}
      </p>
    );
  }
  if (sending)
    return (
      <p className={noteBand} role="status">
        Saving {changesText(waiting)} made offline…
      </p>
    );
  if (note)
    return (
      <p className={noteBand} role="status">
        {note}
      </p>
    );
  return null;
}

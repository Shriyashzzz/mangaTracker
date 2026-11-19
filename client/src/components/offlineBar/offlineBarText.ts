// What the offline bar says, worked out from the app's state. Pure, so the
// server's Jest can test it (OfflineBar.tsx draws it).
export type BarState = {
  online: boolean;
  // when the shelf on screen was kept; null while it's fresh
  savedAt: number | null;
  // changes waiting to be sent, whether they're going now, and how the last
  // send went
  waiting: number;
  sending: boolean;
  note: string | null;
};

// the ink band while offline; a wash for how sending went
export type BarText =
  | { tone: "offline"; lead: string; text: string }
  | { tone: "note"; text: string }
  | null;

const changesText = (n: number) => (n === 1 ? "1 change" : `${n} changes`);

// "2:14 PM", or "Nov 18" for a copy from another day
export function keptText(savedAt: number, now = Date.now()) {
  const kept = new Date(savedAt);
  const today = new Date(now).toDateString() === kept.toDateString();
  return today
    ? kept.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : kept.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function offlineBarText(state: BarState, now = Date.now()): BarText {
  const { online, savedAt, waiting, sending, note } = state;
  if (!online || savedAt != null) {
    // how old the shelf on screen is, and what's waiting: each said once
    const shelf = savedAt ? `Your shelf as of ${keptText(savedAt, now)}.` : "";
    let changes = "";
    if (waiting === 1) changes = "1 change waiting: it saves when you're back.";
    else if (waiting > 1)
      changes = `${waiting} changes waiting: they save when you're back.`;
    else if (!savedAt)
      changes = "Chapters and volumes you change save when you're back.";
    const text = [shelf, changes].filter(Boolean).join(" ");
    return { tone: "offline", lead: "Offline.", text };
  }
  if (sending)
    return {
      tone: "note",
      text: `Saving ${changesText(waiting)} made offline…`,
    };
  if (note) return { tone: "note", text: note };
  return null;
}

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

// a quiet "Offline" while offline; a wash for how sending went
export type BarText =
  { tone: "offline"; text: string } | { tone: "note"; text: string } | null;

const changesText = (n: number) => (n === 1 ? "1 change" : `${n} changes`);

export function offlineBarText(state: BarState): BarText {
  const { online, savedAt, waiting, sending, note } = state;
  // just the word: greyed Prices and New, and the counter's own note, say
  // the rest
  if (!online || savedAt != null) return { tone: "offline", text: "Offline" };
  if (sending)
    return {
      tone: "note",
      text: `Saving ${changesText(waiting)} made offline…`,
    };
  if (note) return { tone: "note", text: note };
  return null;
}

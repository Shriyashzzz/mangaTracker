// When the Play app asks about alerts (components/alertsPeek/AlertsPeek.tsx).
// Android 13 and later want the reader's yes before an app notifies, so
// alerts can't start on by themselves; Kenji asks once there's a series on
// the shelf, the moment they mean something. "Not now" waits two weeks.
// Switched off in Settings is their answer: never asked again, and never
// switched back on quietly. Kept on this device
const ASKED_KEY = "alertsAskedAt";
const CHOSE_OFF_KEY = "alertsChoseOff";
const WAIT_MS = 14 * 24 * 60 * 60 * 1000;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // nothing to keep it in: the question can come back, Settings still works
  }
};

// the reader switched alerts off in Settings on this device
export const choseAlertsOff = () => read(CHOSE_OFF_KEY) === "yes";
export const markChoseAlertsOff = (off: boolean) =>
  write(CHOSE_OFF_KEY, off ? "yes" : "no");

// answered or put off just now
export const markAlertsAsked = (now = Date.now()) =>
  write(ASKED_KEY, String(now));

// two weeks since it was last put off, or never asked
export const alertsAskDue = (now = Date.now()) => {
  const at = Number(read(ASKED_KEY));
  return !choseAlertsOff() && (!at || now - at >= WAIT_MS);
};

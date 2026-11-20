// Asking a new Google reader, once, if they'd like the weekly email. Their
// Google email is saved, confirmed, with the weekly email off: a tap on
// "Yes, send it" is their yes (Canada's CASL and the EU want one before
// it's sent), so nothing weekly goes out without it. Marked on this device
// when the account is made, and asked on the shelf when Kenji has his turn
// (lib/notes.ts: the tour comes first, one note a visit), so it can wait for
// a later visit
const KEY = "weeklyEmailAsk";

// a Google sign-up just made their account
export function markWeeklyAsk() {
  try {
    localStorage.setItem(KEY, "ask");
  } catch {
    // storage blocked: Settings still has the switch
  }
}

export function weeklyAskWaiting() {
  try {
    return localStorage.getItem(KEY) === "ask";
  } catch {
    return false;
  }
}

// asked: answered, closed, or left to go. Never again; Settings has it
export function weeklyAskDone() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to tidy
  }
}

// Asking a Google reader if they'd like the weekly email, when theirs is
// off: an account made before 2026-11-22 (new Google accounts start with it
// on: server models/userQueries.ts addGoogleUser), or one that switched it
// off. A tap on "Yes, send it" turns it on.
//
// Decided by the account, not by the moment it was made, so every device
// they use asks: a Google reader with an email and the weekly email off.
// Each device asks once: answered or closed, it's marked here and not asked
// again (left alone, it asks another visit). Settings always has the switch
import type { Account } from "./account";

const KEY = "weeklyEmailAsked";

export const askedOnThisDevice = () => {
  try {
    return localStorage.getItem(KEY) === "yes";
  } catch {
    // storage blocked: not asked, so the question never repeats on a loop
    return true;
  }
};

// answered or closed on this device
export function markAsked() {
  try {
    localStorage.setItem(KEY, "yes");
  } catch {
    // nothing to keep it in; Settings has the switch
  }
}

// the account a question is for: signed in with Google, its email saved and
// confirmed (Google checked it), the weekly email not on
export const weeklyAskFits = (account: Account | null) =>
  Boolean(
    account?.google &&
    account.recoveryEmail &&
    account.emailConfirmed &&
    !account.weeklyEmail,
  );

// worth asking on this device now
export const weeklyAskDue = (account: Account | null, asked: boolean) =>
  !asked && weeklyAskFits(account);

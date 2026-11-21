// Whether the site is open inside its Google Play app (a Trusted Web
// Activity: Chrome showing the site full screen as an Android app). Google
// Play's rules want its own billing for paying the developer from inside an
// app, so the coffee asks (Kenji, the menu row, About) don't show there.
// Store links are fine: books are physical goods.
//
// The app opens the site with its own address as the referrer
// (lib/playAppReferrer.ts), only on the first page: it's remembered for the
// rest of the visit.
import { openedFromPlayApp, PLAY_PACKAGE } from "./playAppReferrer";

const KEY = "inPlayApp";
// which app it is: the Play app, or a test build of it (xyz.mangatracker.app.dev)
const PACKAGE_KEY = "playAppPackage";
// which release of it: the app adds ?appVersion= to the first page
// (android/…/LauncherActivity.java). The first release didn't: 1
const VERSION_KEY = "playAppVersion";
// whether Android lets the app notify, as the app said when it opened the
// page (?notifications=on|off): Chrome doesn't hear of a change made in
// Android's settings, the app reads it fresh every time
const NOTIFY_KEY = "playAppNotifications";

// called once as the site starts
export function notePlayApp() {
  try {
    const address = new URL(window.location.href);
    const version = address.searchParams.get("appVersion");
    const notify = address.searchParams.get("notifications");
    if (version) sessionStorage.setItem(VERSION_KEY, version);
    if (notify === "on" || notify === "off")
      sessionStorage.setItem(NOTIFY_KEY, notify);
    if (version || notify) {
      // kept out of the address bar, links and shares
      address.searchParams.delete("appVersion");
      address.searchParams.delete("notifications");
      window.history.replaceState(window.history.state, "", address);
    }
    if (openedFromPlayApp(document.referrer)) {
      sessionStorage.setItem(KEY, "yes");
      sessionStorage.setItem(
        PACKAGE_KEY,
        new URL(document.referrer).hostname || PLAY_PACKAGE,
      );
    }
  } catch {
    // storage blocked: the asks show, as on the website
  }
}

export const inPlayApp = () => {
  try {
    return sessionStorage.getItem(KEY) === "yes";
  } catch {
    return false;
  }
};

// what the installed app can do for the site (android/…/AppLinkActivity.java),
// by the release that added it. Nothing for the website, nor an older app
const APP_CAN = {
  // Android's "Allow notifications?", or the app's notification settings
  notifications: 2,
  // the app's page in Android's settings
  "app-settings": 2,
  // Google Play's rating sheet
  review: 2,
  // silent: has Android's notification setting changed since the app said?
  check: 2,
} as const;
export type AppAction = keyof typeof APP_CAN;

const appVersion = () => {
  try {
    return Number(sessionStorage.getItem(VERSION_KEY)) || 1;
  } catch {
    return 1;
  }
};
const appPackage = () => {
  try {
    return sessionStorage.getItem(PACKAGE_KEY) || PLAY_PACKAGE;
  } catch {
    return PLAY_PACKAGE;
  }
};

export const appCan = (action: AppAction) =>
  inPlayApp() && appVersion() >= APP_CAN[action];

// asks the app to do it; if somehow it can't, the page stays as it is. The
// app may open this page again when it's done (?back=): notifications,
// allowed, reopen it so Chrome reads Android's new answer
const ASKED_KEY = "askedAppFor";
export function askApp(action: AppAction, said?: string) {
  // a check asks nothing of the reader: nothing to finish afterwards
  if (action !== "check") {
    try {
      sessionStorage.setItem(ASKED_KEY, action);
    } catch {
      // the page just won't switch alerts on by itself
    }
  }
  const here = encodeURIComponent(window.location.href);
  const extra = said ? `&said=${said}` : "";
  window.location.href = `intent://${action}?back=${here}${extra}#Intent;scheme=mangatracker;package=${appPackage()};S.browser_fallback_url=${here};end`;
}

// back on a page from elsewhere (Android's settings, another app): the app
// checks Android's notification setting, unseen, and opens the page again
// only if it changed since it last said
// at most one check every so often: the app's own unseen screen coming and
// going must never set off another
const CHECKED_KEY = "appCheckedAt";
const CHECK_EVERY_MS = 10_000;
export function checkAppNotifications(now = Date.now()) {
  if (!appCan("check")) return;
  try {
    const said = sessionStorage.getItem(NOTIFY_KEY);
    const last = Number(sessionStorage.getItem(CHECKED_KEY));
    if (said !== "on" && said !== "off") return;
    if (last && now - last < CHECK_EVERY_MS) return;
    sessionStorage.setItem(CHECKED_KEY, String(now));
    askApp("check", said);
  } catch {
    // no storage: no check, the page says what it last heard
  }
}

// the app was asked for this on this visit: true once, then forgotten
export function askedApp(action: AppAction) {
  try {
    if (sessionStorage.getItem(ASKED_KEY) !== action) return false;
    sessionStorage.removeItem(ASKED_KEY);
    return true;
  } catch {
    return false;
  }
}

// Android has the app's notifications off, as the app said on opening
export const appNotificationsOff = () => {
  try {
    return (
      appCan("notifications") && sessionStorage.getItem(NOTIFY_KEY) === "off"
    );
  } catch {
    return false;
  }
};

// Whether Manga Tracker is running as an app: the Google Play app (opened
// with its own referrer, lib/playApp.ts) or added to a home screen (it opens
// standalone, lib/install.ts). Inside it, it behaves like one: no website
// footer, a back arrow with the screen's name in place of breadcrumbs, the
// shelf scrolling on rather than paging, no pull-to-reload. The website is
// unchanged. Marked on <html> as "in-app" so styles can follow it too
import { runsAsApp } from "./install";
import { inPlayApp } from "./playApp";

export const inApp = () => runsAsApp() || inPlayApp();

// called once as the page starts, after the Play app's referrer is noted
export function markInApp() {
  if (inApp()) document.documentElement.classList.add("in-app");
}

// the bottom bar's tabs' own screens, where the app keeps the logo; any
// other screen has a back arrow and its name (layouts/header/AppBackBar.tsx)
const TAB_SCREENS = new Set(["/", "/shelf", "/prices", "/to-buy"]);
export const isTabScreen = (pathname: string) => TAB_SCREENS.has(pathname);

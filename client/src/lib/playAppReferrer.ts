// How a page knows the Google Play app opened it: the app opens the site with
// its own address as the referrer ("android-app://xyz.mangatracker.app/"),
// only on the first page. No browser needed, so the site server reads it too
// (server.ts: no crawler text before the app starts). lib/playApp.ts
// remembers it for the rest of the visit.

// the Play app's package name (android/twa-manifest.json)
export const PLAY_PACKAGE = "xyz.mangatracker.app";

export const openedFromPlayApp = (referrer: string) =>
  referrer.startsWith(`android-app://${PLAY_PACKAGE}`);

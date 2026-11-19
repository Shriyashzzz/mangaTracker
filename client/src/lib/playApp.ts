// Whether the site is open inside its Google Play app (a Trusted Web
// Activity: Chrome showing the site full screen as an Android app). Google
// Play's rules want its own billing for paying the developer from inside an
// app, so the coffee asks (Kenji, the menu row, About) don't show there.
// Store links are fine: books are physical goods.
//
// The app opens the site with its own address as the referrer
// ("android-app://xyz.mangatracker.app/"), only on the first page: it's
// remembered for the rest of the visit.

// the Play app's package name (android/twa-manifest.json)
export const PLAY_PACKAGE = "xyz.mangatracker.app";
const KEY = "inPlayApp";

export const openedFromPlayApp = (referrer: string) =>
  referrer.startsWith(`android-app://${PLAY_PACKAGE}`);

// called once as the site starts
export function notePlayApp() {
  try {
    if (openedFromPlayApp(document.referrer))
      sessionStorage.setItem(KEY, "yes");
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

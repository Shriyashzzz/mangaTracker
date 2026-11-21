// where the shelf tab picked this visit is kept, in this browser tab's
// sessionStorage (pages/Home/useShelfTab.ts). A file of its own, with no
// imports, so lib/shelf.ts can name it without loading the prefs and demo
// code; forgotten on sign-in and sign-out (lib/prefs.ts forgetShelfTab)
export const SHELF_TAB_KEY = "libraryStatus";
// the series left open on the Volumes tab (pages/Home/VolumesView.tsx)
export const VOLUMES_OPEN_KEY = "volumesOpen";

// how many times that's happened this visit: the shelf page starts afresh
// each time the number moves (pages/Home/Home.tsx)
let resets = 0;
export const shelfResets = () => resets;

// My shelf tapped while already on the shelf (layouts/header/Header.tsx):
// it opens as it does at first, on their own start tab with nothing open
export function forgetShelfPlace() {
  resets++;
  try {
    sessionStorage.removeItem(SHELF_TAB_KEY);
    sessionStorage.removeItem(VOLUMES_OPEN_KEY);
  } catch {
    // storage can be blocked: the shelf keeps its place then
  }
}

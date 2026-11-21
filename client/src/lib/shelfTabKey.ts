// where the shelf tab picked this visit is kept, in this browser tab's
// sessionStorage (pages/Home/useShelfTab.ts). A file of its own, with no
// imports, so lib/shelf.ts can name it without loading the prefs and demo
// code; forgotten on sign-in and sign-out (lib/prefs.ts forgetShelfTab)
export const SHELF_TAB_KEY = "libraryStatus";

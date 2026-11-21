// Runs as the very first thing, before the router is made (main.tsx imports
// it first): opened inside the Google Play app is noted for the visit, and
// the app's ?appVersion= is taken out of the address before the router
// copies it into its own (lib/playApp.ts)
import { notePlayApp } from "./playApp";

notePlayApp();

// Browser entry point: mount the router into #root.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./pages/routes";
import { listenForInstall } from "./lib/install";

// the browser offers to install the site as an app once, early: kept for
// the "Install the app" button
listenForInstall();

// a deploy replaced the page code an open tab still asks for: load the new
// version, once (a second failure in a minute shows the error page instead)
window.addEventListener("vite:preloadError", (e) => {
  const RELOADED = "reloadedForNewVersion";
  const last = Number(sessionStorage.getItem(RELOADED) ?? 0);
  if (Date.now() - last < 60_000) return;
  e.preventDefault();
  sessionStorage.setItem(RELOADED, String(Date.now()));
  window.location.reload();
});

// the service worker (public/sw.js): what lets the site be installed as an
// app and open offline. Only on the built site: on a laptop's dev server it
// would hold on to files Vite is still changing
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

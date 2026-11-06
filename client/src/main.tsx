// Browser entry point: mount the router into #root.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./pages/routes";

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// Shortcuts on the shelf, for anyone with a keyboard: / searches it, n adds
// one. Not while typing, with a dialog, menu or the tour open, mid-Select,
// held down, or with a modifier.
import { useEffect } from "react";
import { useNavigate } from "react-router";

export function useShelfShortcuts(selectOn: boolean) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // not while a menu, the tour or Select has their attention
      if (selectOn) return;
      if (document.querySelector('[aria-expanded="true"], .tour-bubble'))
        return;
      const at = e.target as HTMLElement | null;
      if (at?.closest("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "/") {
        e.preventDefault();
        // on phones the search folds into a magnifier, which opens it
        const magnifier = document.querySelector<HTMLElement>(
          "[data-shelf-magnifier]",
        );
        if (magnifier?.getClientRects().length) magnifier.click();
        else
          document.querySelector<HTMLElement>("[data-shelf-search]")?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        navigate("/add", { viewTransition: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, selectOn]);
}

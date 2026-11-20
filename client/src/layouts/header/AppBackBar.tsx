// In the app (lib/inApp.ts), a screen below the bottom bar's tabs shows a back
// arrow and its name where the website shows the logo, as an Android app's
// top bar does. The name is the page's short screen name when it gives one
// (lib/seo.ts PageMeta.screen), else its title without " | Manga Tracker".
// Back goes back in the app's history, or with none (opened from a link) to
// the screen's tab
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChevronLeftIcon } from "../../components/icons/Icons";
import { TAB_HOME, tabOf } from "../../lib/tabMemory";

const screenName = () =>
  document.documentElement.dataset.screen ||
  document.title.replace(/\s*\|\s*Manga Tracker$/, "");

// the page's title as it changes (each page sets its own)
function useScreenName() {
  const [name, setName] = useState(screenName);
  useEffect(() => {
    const title = document.querySelector("title");
    if (!title) return;
    const watcher = new MutationObserver(() => setName(screenName()));
    watcher.observe(title, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => watcher.disconnect();
  }, []);
  return name;
}

export default function AppBackBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const name = useScreenName();
  const back = () => {
    // React Router counts this visit's pages: 0 is the first one opened
    const hasHistory =
      ((window.history.state as { idx?: number })?.idx ?? 0) > 0;
    if (hasHistory) navigate(-1);
    else
      navigate(TAB_HOME[tabOf(pathname) ?? "shelf"], { viewTransition: true });
  };
  return (
    <div className="mr-auto flex min-w-0 items-center gap-2">
      <button
        type="button"
        className="tap -ml-2 grid size-11 shrink-0 place-items-center"
        aria-label="Back"
        onClick={back}
      >
        <ChevronLeftIcon className="size-6" aria-hidden />
      </button>
      <span className="truncate font-brand text-[1.45rem] leading-none tracking-[1px] uppercase">
        {name}
      </span>
    </div>
  );
}

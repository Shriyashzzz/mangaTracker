// In the app (lib/inApp.ts), a screen below the bottom bar's tabs shows a back
// arrow and its name where the website shows the logo, as an Android app's
// top bar does. The name is the page's short screen name when it gives one
// (lib/seo.ts PageMeta.screen), else its title without " | Manga Tracker".
// Back goes back in the app's history, or with none (opened from a link) to
// the screen's tab. When the page's own heading says the same name
// ("Settings", "Vagabond"), the bar's name waits until it's scrolled out of
// sight, then fades in: said once, as an Android app's collapsing title
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

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// whether the page's heading, saying the same name, is on screen. Pages draw
// their heading once their data comes, so it's looked for as the page changes
function useHeadingShowsName(name: string) {
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    let seen: Element | null = null;
    let watching: IntersectionObserver | null = null;
    const find = () => {
      const heading = [...document.querySelectorAll("main h1")].find((h) =>
        same(h.textContent ?? "", name),
      );
      if (heading === seen) return;
      seen = heading ?? null;
      watching?.disconnect();
      if (!heading) return setShowing(false);
      // under the top bar counts as gone
      watching = new IntersectionObserver(
        ([entry]) => setShowing(Boolean(entry?.isIntersecting)),
        { rootMargin: "-64px 0px 0px 0px" },
      );
      watching.observe(heading);
    };
    find();
    let frame = 0;
    const changes = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(find);
    });
    const main = document.querySelector("main");
    if (main) changes.observe(main, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      changes.disconnect();
      watching?.disconnect();
    };
  }, [name]);
  return showing;
}

export default function AppBackBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const name = useScreenName();
  const headingShowsName = useHeadingShowsName(name);
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
      <span
        className={`truncate font-brand text-[1.45rem] leading-none tracking-[1px] uppercase transition-opacity duration-200 ${headingShowsName ? "opacity-0" : "opacity-100"}`}
        aria-hidden={headingShowsName || undefined}
      >
        {name}
      </span>
    </div>
  );
}

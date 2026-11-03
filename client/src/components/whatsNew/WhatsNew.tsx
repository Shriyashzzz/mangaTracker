// The "what's new" list, out in the empty margin right of the page so the page
// itself keeps its full width. Screens without that margin get ReleaseTip
// instead (same 1340px line), so every screen hears about it exactly one way.
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { useReleaseChecksOn } from "../../lib/prefs";
import { openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";
import TakeTourButton from "../tour/TakeTourButton";

const ITEMS = [
  {
    name: "Import from more places",
    body: "Goodreads, AniList, Kitsu, Book Catalogue, or any CSV.",
  },
  {
    name: "Better search results",
    body: "Greater accuracy and a wider list of live prices.",
  },
];

// children sit above the list, in the same margin column
export default function WhatsNew({ children }: { children?: ReactNode }) {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const checksOn = useReleaseChecksOn();

  return (
    // as wide as the margin allows: half the space beside the page's content,
    // less the gap either side
    <div className="absolute top-0 left-full ml-4 flex w-[min(250px,calc((100vw_-_var(--container-page)_+_2_*_var(--gutter))_/_2_-_28px))] flex-col gap-4 max-[1339px]:hidden">
      {children}
      <aside
        className="relative border-[2.5px] border-dashed border-line bg-card px-3 py-3"
        aria-labelledby="whats-new-title"
      >
        <span
          className="absolute -top-[0.95rem] -right-1 rotate-6 font-brand text-[1.35rem] tracking-[0.03em] text-accent uppercase [-webkit-text-stroke:1.2px_var(--line)] [paint-order:stroke_fill]"
          aria-hidden
        >
          New!
        </span>
        <h2
          id="whats-new-title"
          className="font-brand text-[1.2rem] leading-none font-normal tracking-[0.03em] uppercase"
        >
          What's new
        </h2>

        <h3 className="mt-2 font-display text-[0.98rem] leading-[1.15] font-medium">
          New English volumes
        </h3>
        <p className="mt-1 text-[0.82rem] leading-[1.35] text-ink-soft">
          See which series on your shelf have a new volume or chapter out in
          English.
        </p>
        {/* a guest's way in is the box above; two sign-ups would be one too many */}
        {isSignedIn && checksOn && (
          <NavLink
            to="/shelf"
            className="tap mt-1 inline-block py-1 text-[0.82rem] font-medium whitespace-nowrap text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line"
            onClick={openReleasesOnShelf}
            viewTransition
          >
            Check shelf →
          </NavLink>
        )}

        {/* just the names in a slim margin; wider ones have room to explain */}
        {/* anyone can try the whole site on a practice shelf, signed in or not */}
        <div className="mt-3 border-t-[1.5px] border-line-soft pt-3">
          <p className="text-[0.82rem] leading-[1.35] text-ink-soft">
            Play through the quick walkthrough to learn the basics or discover
            what’s new.
          </p>
          <div className="mt-1.5">
            <TakeTourButton
              small
              className="tap mt-2 inline-block text-[0.82rem] font-medium whitespace-nowrap text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink"
            />
          </div>
        </div>
        <ul className="mt-2 border-t-[1.5px] border-line-soft">
          {ITEMS.map((item) => (
            <li
              key={item.name}
              className="border-b border-dashed border-line-soft py-[0.4rem] text-[0.8rem] leading-[1.3] text-ink-soft last:border-b-0 last:pb-0"
            >
              <strong className="font-medium text-ink-soft min-[1560px]:font-semibold min-[1560px]:text-ink">
                {item.name}
              </strong>
              <span className="mt-[0.1rem] hidden min-[1560px]:block">
                {item.body}
              </span>
            </li>
          ))}
        </ul>
        <NavLink
          to="/updates"
          className="tap mt-2 inline-block text-[0.82rem] font-medium whitespace-nowrap text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink"
          viewTransition
        >
          All updates →
        </NavLink>
      </aside>
    </div>
  );
}

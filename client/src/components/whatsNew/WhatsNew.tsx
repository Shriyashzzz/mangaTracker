// The "what's new" list beside the price search. Phones and small tablets get
// ReleaseTip instead, so every screen hears about it exactly one way.
import { NavLink } from "react-router";
import { openReleasesOnShelf } from "../../lib/shelf";
import { useAuth } from "../../store/auth";

const ITEMS = [
  {
    name: "In Japan",
    body: "See the volumes Japan already has, before English catches up.",
  },
  {
    name: "Next chapter dates",
    body: "A volume behind? The manga's page shows when the next chapter should land.",
  },
  {
    name: "Title suggestions",
    body: "Adding a manga? Pick its title and the cover and genre fill in.",
  },
];

export default function WhatsNew() {
  const isSignedIn = useAuth((s) => s.isSignedIn);

  return (
    <aside
      className="relative border-3 border-dashed border-line bg-card px-5 py-4 upto-860:hidden"
      aria-labelledby="whats-new-title"
    >
      <span
        className="absolute -top-[1.1rem] right-4 rotate-6 font-brand text-[1.7rem] tracking-[0.03em] text-accent uppercase [-webkit-text-stroke:1.5px_var(--line)] [paint-order:stroke_fill]"
        aria-hidden
      >
        New!
      </span>
      <h2
        id="whats-new-title"
        className="font-brand text-[1.45rem] font-normal tracking-[0.03em] uppercase"
      >
        What's new
      </h2>

      <h3 className="mt-2 font-display text-[1.2rem] leading-[1.2] font-medium">
        New release check
      </h3>
      <p className="mt-1 text-[0.92rem] leading-[1.4] text-ink-soft">
        See which series on your shelf have a new volume or chapter out.
      </p>
      {/* wait for the answer so a signed-in reader never sees the guest link */}
      {isSignedIn !== null && (
        <NavLink
          to={isSignedIn ? "/shelf" : "/signup"}
          className="mt-1 inline-block py-1 text-[0.92rem] font-medium text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line"
          onClick={isSignedIn ? openReleasesOnShelf : undefined}
          viewTransition
        >
          {isSignedIn ? "Check my shelf →" : "Start your shelf →"}
        </NavLink>
      )}

      <ul className="mt-2 border-t-[1.5px] border-line-soft">
        {ITEMS.map((item) => (
          <li
            key={item.name}
            className="border-b border-dashed border-line-soft py-[0.45rem] text-[0.84rem] leading-[1.35] text-ink-soft last:border-b-0 last:pb-0"
          >
            <strong className="font-semibold text-ink">{item.name}.</strong>{" "}
            {item.body}
          </li>
        ))}
      </ul>
    </aside>
  );
}

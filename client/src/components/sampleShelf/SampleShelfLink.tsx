// Lets someone look at a real shelf before signing up: the shared list of the demo
// account that server/src/seedSampleShelf.ts creates.
import { NavLink } from "react-router";

const link =
  "tap py-2 font-medium whitespace-nowrap text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line";

export default function SampleShelfLink() {
  return (
    <>
      <NavLink to="/u/sample" className={link} viewTransition>
        See a sample shelf
      </NavLink>
      <NavLink to="/guide" className={link} viewTransition>
        Take the tour
      </NavLink>
    </>
  );
}

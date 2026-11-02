// Lets someone look at a real shelf before signing up: the shared list of a demo
// account. Hidden until VITE_SAMPLE_SHELF_CODE names that account's share code.
import { NavLink } from "react-router";

const CODE: string | undefined = import.meta.env.VITE_SAMPLE_SHELF_CODE;

export default function SampleShelfLink() {
  if (!CODE) return null;
  return (
    <NavLink
      to={`/u/${encodeURIComponent(CODE)}`}
      className="tap py-2 font-medium whitespace-nowrap text-ink underline decoration-accent decoration-2 underline-offset-3 hover:decoration-line"
      viewTransition
    >
      See a sample shelf
    </NavLink>
  );
}

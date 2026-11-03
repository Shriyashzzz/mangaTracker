import { startDemo } from "../../lib/demo";

// starts Kenji's tour. It never starts on its own
export default function TakeTourButton({
  large = false,
  small = false,
}: {
  large?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-secondary ${large ? "btn-lg" : small ? "btn-sm" : ""}`}
      onClick={startDemo}
    >
      Take the tour
    </button>
  );
}

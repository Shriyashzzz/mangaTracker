import { startDemo } from "../../lib/demo";

// starts Kenji's tour. It never starts on its own
export default function TakeTourButton({ large = false }: { large?: boolean }) {
  return (
    <button
      type="button"
      className={`btn btn-secondary ${large ? "btn-lg" : ""}`}
      onClick={startDemo}
    >
      Take the tour
    </button>
  );
}

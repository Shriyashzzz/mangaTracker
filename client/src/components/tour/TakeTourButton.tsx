import { startDemo } from "../../lib/demo";

// starts Kenji's tour. It never starts on its own
export default function TakeTourButton({ className }: { className: string }) {
  return (
    <button type="button" className={className} onClick={startDemo}>
      Take the tour
    </button>
  );
}

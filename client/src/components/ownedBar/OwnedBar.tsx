// A row's bar on the Volumes tab (pages/Home/VolumesView.tsx): what they own
// of a series, inked in, and empty where a volume or book isn't theirs, so a
// gap is a break in the bar. An edition's books and the singles after them
// are pills of their own (lib/ownedBar.ts). Opened, the bar is a map: a tap
// on it moves the shelf under it to that spot (`onPick`)
import type { MouseEvent } from "react";
import { barRuns, shareOf } from "../../lib/ownedBar";

type Props = {
  owned: number[];
  total: number;
  books?: number[][] | null;
  // a tap on the bar: the volume under the finger
  onPick?: (volume: number) => void;
};

export default function OwnedBar({
  owned,
  total,
  books = null,
  onPick,
}: Props) {
  const runs = barRuns(total, books);
  if (!runs.length) return null;
  const mine = new Set(owned);
  // the volume at that spot along the bar, as its slots lie
  const pick = (e: MouseEvent<HTMLSpanElement>) => {
    if (!onPick) return;
    const slot = (e.target as HTMLElement).closest<HTMLElement>("[data-from]");
    if (!slot) return;
    // the bar sits in the row's button: the row stays open
    e.preventDefault();
    e.stopPropagation();
    onPick(Number(slot.dataset.from));
  };
  return (
    <span
      className={`flex gap-1 ${onPick ? "cursor-pointer py-1.5 -my-1.5" : ""}`}
      onClick={pick}
      aria-hidden
    >
      {runs.map((run, i) => {
        const width = run.slots.reduce((n, s) => n + s.volumes.length, 0);
        return (
          <span
            key={i}
            // a short run of singles stays a pill, never a dot
            className="flex h-2 min-w-3 overflow-hidden rounded-full border border-line bg-card"
            style={{ flexGrow: width }}
          >
            {run.slots.map((slot) => (
              <span
                key={slot.volumes[0]}
                data-from={slot.volumes[0]}
                className="relative h-full"
                style={{ flexGrow: slot.volumes.length, flexBasis: 0 }}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-ink-soft"
                  style={{ width: `${shareOf(slot, mine) * 100}%` }}
                />
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

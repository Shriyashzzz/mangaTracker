// The app's swipe to refresh, drawn in the app's own world rather than
// Chrome's round spinner (lib/usePullToRefresh.ts does the pulling). Kenji
// drops in on a rope from the top bar: curious as they pull, grinning once
// letting go would refresh, reading while the shelf comes back. Now and then
// it's a comic action burst instead, "グイ…" growing to "ドン!" and spinning
// in speed lines: an easter egg, never on someone's first pull and never two
// in a row (pickLook). Still for anyone who asked for less motion
import Mascot from "../mascot/Mascot";
import type { Look } from "./pullLook";

// a comic burst's points, 14 spikes round a 100 by 100 box
const BURST = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 ? 30 : 46;
  const a = (Math.PI * i) / 14;
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");

export default function PullRefresh({
  pull,
  busy,
  ready,
  look,
}: {
  pull: number;
  busy: boolean;
  ready: boolean;
  look: Look;
}) {
  if (pull <= 0 && !busy) return null;
  // under the top bar, wherever it ends
  const top =
    document.querySelector(".masthead")?.getBoundingClientRect().bottom ?? 64;
  const height = Math.max(pull, 0);
  // Kenji grows with the pull, and always fits under his rope in the gap
  // (his drawing is 140 by 160)
  const rope = 6 + pull / 10;
  const kenji = Math.max(
    0,
    Math.min(40 + pull / 4, ((height - rope - 4) * 140) / 160),
  );
  // what it's doing: following the finger, ready to let go, or refreshing
  const stage = busy ? "busy" : ready ? "ready" : "pull";

  return (
    <div
      className="pull-zone"
      data-stage={stage}
      style={{ top, height }}
      role={busy ? "status" : undefined}
      aria-label={busy ? "Refreshing" : undefined}
    >
      {look === "kenji" ? (
        <>
          <span className="pull-rope" style={{ height: rope }} />
          {/* Kenji as he's drawn, light whatever the theme, as everywhere else
              he appears (index.css .printed) */}
          <span
            className="printed pull-kenji"
            style={{ top: rope, width: kenji }}
          >
            <Mascot
              mood={
                stage === "busy"
                  ? "reading"
                  : stage === "ready"
                    ? "happy"
                    : "curious"
              }
            />
          </span>
          {busy && (
            <span className="pull-pages" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          )}
        </>
      ) : (
        <>
          {busy && <span className="pull-lines" aria-hidden />}
          <svg
            className="pull-burst"
            viewBox="0 0 100 100"
            style={{ width: 40 + Math.min(pull, 96) * 0.65 }}
            aria-hidden
          >
            <polygon points={BURST} />
          </svg>
          <span className="pull-sfx" aria-hidden>
            {stage === "busy"
              ? "・・・"
              : stage === "ready"
                ? "ドン!"
                : "グイ…"}
          </span>
        </>
      )}
    </div>
  );
}

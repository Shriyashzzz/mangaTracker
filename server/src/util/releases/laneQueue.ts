// Release checks wait their turn in two lanes, one job at a time with a pause
// between (MangaDex and MangaUpdates are shared by everyone's checks). "now" is
// what someone is likely waiting on: a series they're caught up on or rated
// highly, or one whose page they've opened. "later" is the rest of a big
// shelf, and only runs when "now" is empty. A job already running always
// finishes. Asked for again in "now", a job waiting in "later" moves up.
export type Lane = "now" | "later";

type Job<T> = { key: string; run: () => Promise<T>; done: (answer: T) => void };

export function laneQueue<T>({
  pauseMs,
  // "later" holds at most this many; past it, a new one is turned away
  maxLater,
  onFailure,
}: {
  pauseMs: number;
  maxLater: number;
  onFailure: T;
}) {
  const lanes: Record<Lane, Job<T>[]> = { now: [], later: [] };
  let working = false;

  async function work() {
    if (working) return;
    working = true;
    try {
      for (;;) {
        const job = lanes.now.shift() ?? lanes.later.shift();
        if (!job) break;
        let answer = onFailure;
        try {
          answer = await job.run();
        } catch {
          // a failed job is an answer too: the next check asks again
        }
        job.done(answer);
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    } finally {
      working = false;
    }
  }

  return {
    // its answer once its turn comes. Null: "later" is full, nothing queued
    add(key: string, lane: Lane, run: () => Promise<T>): Promise<T> | null {
      if (lane === "later" && lanes.later.length >= maxLater) return null;
      let done!: (answer: T) => void;
      const answer = new Promise<T>((resolve) => (done = resolve));
      lanes[lane].push({ key, run, done });
      void work();
      return answer;
    },
    // waiting in "later" and wanted now: to the back of "now"
    promote(key: string) {
      const i = lanes.later.findIndex((j) => j.key === key);
      if (i >= 0) lanes.now.push(...lanes.later.splice(i, 1));
    },
    size: () => ({ now: lanes.now.length, later: lanes.later.length }),
  };
}

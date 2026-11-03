// One person's shelf changes, one at a time: "is it already there?" and
// adding it happen together, so two imports or adds running at once (two
// tabs, a retry while the first is still going) can't both add the same
// title. In memory, so it holds for one server, like the rate limiter
const queues = new Map<number, Promise<unknown>>();

export function oneAtATime<T>(userId: number, work: () => Promise<T>) {
  const before = queues.get(userId) ?? Promise.resolve();
  const run = before.then(work, work);
  const done = run.catch(() => {});
  queues.set(userId, done);
  // forgotten once nothing is waiting
  void done.then(() => {
    if (queues.get(userId) === done) queues.delete(userId);
  });
  return run;
}

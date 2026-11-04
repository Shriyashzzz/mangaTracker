// Waits for the book import, off the page. Chrome slows a hidden tab's own
// timers to about one a minute after five minutes; a worker's aren't slowed
// that way, so a long import keeps its pace in the background
self.onmessage = (e: MessageEvent<{ id: number; ms: number }>) => {
  const { id, ms } = e.data;
  setTimeout(() => self.postMessage(id), ms);
};

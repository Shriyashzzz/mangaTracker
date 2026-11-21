// What the shelf is worth, what has been spent on it and what finishing each
// series costs (server collector/: saved prices only, never a lookup). Asked
// once when the shelf's All or Volumes tab opens; null until then, and left
// out when it can't be had (switched off, or unreachable)
import { useEffect, useState } from "react";
import { getShelfTools, type ShelfTools } from "../../lib/collector";

export function useShelfTools() {
  const [tools, setTools] = useState<ShelfTools | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getShelfTools(controller.signal)
      .then(setTools)
      .catch(() => {
        // the tab as it always was
      });
    return () => controller.abort();
  }, []);
  return tools;
}

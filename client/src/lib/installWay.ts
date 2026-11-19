// Whether and how the site can be put on this device as an app. Pure, so
// the server's Jest can test it (lib/install.ts reads the browser).
//
//   "prompt"  Chrome, Edge, Samsung Internet: the browser has its own
//             install box, which a button can open
//   "ios"     an iPhone or iPad: no install box, but Share, then Add to
//             Home Screen does it, so we show those steps
//   null      already installed, running as the app, or a browser that
//             can't install sites at all (Firefox on a laptop)
export type InstallWay = "prompt" | "ios" | null;

export function installWayOf({
  runsAsApp,
  hasPrompt,
  appleMobile,
}: {
  runsAsApp: boolean;
  hasPrompt: boolean;
  appleMobile: boolean;
}): InstallWay {
  if (runsAsApp) return null;
  if (hasPrompt) return "prompt";
  return appleMobile ? "ios" : null;
}

// An iPhone or iPad. iPads say they're a Mac since iPadOS 13: a "Mac" with
// a touch screen is one
export const isAppleMobile = (userAgent: string, maxTouchPoints: number) =>
  /iPhone|iPad|iPod/.test(userAgent) ||
  (/Macintosh/.test(userAgent) && maxTouchPoints > 1);

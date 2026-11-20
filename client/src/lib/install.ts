// Installing the site as an app, as the browser allows it (installWay.ts
// says which way). The browser offers its install box once, early, as an
// event: listenForInstall keeps it until a button asks for it.
import { create } from "zustand";
import { inPlayApp } from "./playApp";
import { installWayOf, isAppleMobile, type InstallWay } from "./installWay";

// Chrome's own event; not in TypeScript's list of events yet
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = {
  prompt: InstallPrompt | null;
  // installed during this visit
  installed: boolean;
};

const useInstallState = create<InstallState>()(() => ({
  prompt: null,
  installed: false,
}));

// already opened as the app: from the home screen, the dock or the Start menu
export const runsAsApp = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// called once as the site starts, before the browser sends its event
export function listenForInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    // not the browser's own banner: our button opens it, when they want
    e.preventDefault();
    useInstallState.setState({ prompt: e as InstallPrompt });
  });
  window.addEventListener("appinstalled", () =>
    useInstallState.setState({ prompt: null, installed: true }),
  );
}

export function useInstallWay(): InstallWay {
  const { prompt, installed } = useInstallState();
  return installWayOf({
    // the Google Play app is the app already (lib/playApp.ts)
    runsAsApp: installed || runsAsApp() || inPlayApp(),
    hasPrompt: Boolean(prompt),
    appleMobile: isAppleMobile(navigator.userAgent, navigator.maxTouchPoints),
  });
}

// opens the browser's install box. It can only be used once: after it the
// browser sends a new event if it would offer it again
export async function openInstallBox() {
  const { prompt } = useInstallState.getState();
  if (!prompt) return;
  useInstallState.setState({ prompt: null });
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome === "accepted") useInstallState.setState({ installed: true });
}

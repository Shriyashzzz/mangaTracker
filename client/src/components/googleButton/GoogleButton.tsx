// Google's own button (lib/googleSignIn.ts): Google draws it, in its own
// colours and words, as its rules for the button ask. Picking an account
// hands `onCredential` a token for the server to check. When Google's script
// can't be had (no signal, or a blocker) it says so in a line instead.
// Drawn at one width (BUTTON_WIDTH): Google first draws "Continue with
// Google", then, for someone signed in to Google on the device (the Android
// app), a wider "Continue as <name>" with their picture, and a button sized
// to its words would grow the box as it switches. Google only
// lets it be white, blue or black: white on the light paper, black on the
// dark, where white would glare
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GOOGLE_CLIENT_ID, loadGoogle } from "../../lib/googleSignIn";
import { currentTheme } from "../../lib/prefs";

type Props = {
  // "Continue with Google" on the sign-in pages, "Sign in with Google" when
  // linking it in Settings
  text: "continue_with" | "signin_with";
  onCredential: (credential: string) => void;
  // centred on the sign-in cards; at the start of the line in Settings,
  // under its words
  align?: "center" | "start";
};

// Google's button at 300px, or the box's width on a narrower one (Google
// draws it 200 to 400 wide)
const BUTTON_WIDTH = 300;
const MIN_WIDTH = 200;

// the theme as it changes: a pick in Settings (<html data-theme>) or the
// device's own setting
function onThemeChange(changed: () => void) {
  const watcher = new MutationObserver(changed);
  watcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const device = window.matchMedia("(prefers-color-scheme: dark)");
  device.addEventListener("change", changed);
  return () => {
    watcher.disconnect();
    device.removeEventListener("change", changed);
  };
}

export default function GoogleButton({
  text,
  onCredential,
  align = "center",
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const theme = useSyncExternalStore(onThemeChange, currentTheme);
  const [failed, setFailed] = useState(false);
  // the newest handler, for a button drawn once
  const latest = useRef(onCredential);
  useEffect(() => {
    latest.current = onCredential;
  });

  useEffect(() => {
    let gone = false;
    loadGoogle()
      .then((google) => {
        if (gone || !box.current) return;
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (answer) => latest.current(answer.credential),
          ux_mode: "popup",
        });
        // drawn again for a new theme: the old one goes first
        box.current.replaceChildren();
        const width = Math.max(
          MIN_WIDTH,
          Math.min(BUTTON_WIDTH, Math.floor(box.current.clientWidth)),
        );
        google.renderButton(box.current, {
          type: "standard",
          width,
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "rectangular",
          logo_alignment: "left",
          text,
        });
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
    };
  }, [text, theme]);

  if (failed)
    return (
      <p className="font-mono text-[0.8rem] text-muted">
        Google sign-in isn't available right now.
      </p>
    );
  // the height of Google's large button, so nothing jumps when it arrives.
  // Light whatever the theme: Google's frame is a light page, and Android's
  // Chrome paints a white box behind a light frame set in a dark page
  return (
    <div
      ref={box}
      className={`flex min-h-11 w-full [color-scheme:light] ${align === "start" ? "justify-start" : "justify-center"}`}
    />
  );
}

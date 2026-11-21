// Google's own button (lib/googleSignIn.ts): Google draws it, in its own
// colours and words, as its rules for the button ask. Picking an account
// hands `onCredential` a token for the server to check. When Google's script
// can't be had (no signal, or a blocker) it says so in a line instead.
// Drawn at its own size, just around "G Continue with Google". Google only
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
        google.renderButton(box.current, {
          type: "standard",
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
  // the height of Google's large button, so nothing jumps when it arrives
  return (
    <div
      ref={box}
      className={`flex min-h-11 w-full ${align === "start" ? "justify-start" : "justify-center"}`}
    />
  );
}

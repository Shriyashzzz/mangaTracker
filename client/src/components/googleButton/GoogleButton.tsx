// Google's own button (lib/googleSignIn.ts): Google draws it, in its own
// colours and words, as its rules for the button ask. Picking an account
// hands `onCredential` a token for the server to check. When Google's script
// can't be had (no signal, or a blocker) it says so in a line instead
import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, loadGoogle } from "../../lib/googleSignIn";

type Props = {
  // "Continue with Google" on the sign-in pages, "Sign in with Google" when
  // linking it in Settings
  text: "continue_with" | "signin_with";
  onCredential: (credential: string) => void;
};

// Google's button is drawn at a set width: as wide as its box, within
// Google's 200 to 400 pixels
const widthOf = (box: HTMLElement) =>
  Math.round(Math.min(400, Math.max(200, box.offsetWidth || 320)));

export default function GoogleButton({ text, onCredential }: Props) {
  const box = useRef<HTMLDivElement>(null);
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
        google.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          logo_alignment: "center",
          text,
          width: widthOf(box.current),
        });
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
    };
  }, [text]);

  if (failed)
    return (
      <p className="font-mono text-[0.8rem] text-muted">
        Google sign-in isn't available right now.
      </p>
    );
  // the height of Google's large button, so nothing jumps when it arrives
  return <div ref={box} className="flex min-h-11 w-full justify-center" />;
}

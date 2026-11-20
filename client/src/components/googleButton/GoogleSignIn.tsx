// "Continue with Google" above the username form on the sign-in and sign-up
// pages, with "or" under it. Google's answer signs them in, or makes their
// account (lib/googleSignIn.ts), then on to where signing in leads
import { useNavigate, useSearchParams } from "react-router";
import { afterSignIn, errorMessages } from "../../lib/api";
import { signInWithGoogle } from "../../lib/googleSignIn";
import { orOffline } from "../../lib/offline";
import { markWeeklyAsk } from "../../lib/weeklyAsk";
import { useAuth } from "../../store/auth";
import GoogleButton from "./GoogleButton";

type Props = {
  // what went wrong, said where the page says its other problems
  onError: (message: string) => void;
  // while the server checks Google's answer
  onBusy: (busy: boolean) => void;
};

export default function GoogleSignIn({ onError, onBusy }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signedIn = useAuth((s) => s.signedIn);

  const withGoogle = async (credential: string) => {
    onError("");
    onBusy(true);
    try {
      const result = await signInWithGoogle(credential);
      if (result.ok) {
        // a new account (201) with Google's email: asked once, on the shelf,
        // if they'd like the weekly email
        if (result.status === 201) markWeeklyAsk();
        signedIn();
        navigate(afterSignIn(params), { viewTransition: true });
        return;
      }
      onError(
        (await errorMessages(result))[0] ??
          "Google sign-in didn't work. Try again.",
      );
    } catch {
      onError(orOffline("Something went wrong. Please try again."));
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <GoogleButton text="continue_with" onCredential={withGoogle} />
      <p className="flex items-center gap-3 font-mono text-[0.8rem] text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        or
      </p>
    </div>
  );
}

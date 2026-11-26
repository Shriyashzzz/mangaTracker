// "Continue with Google" and "Continue with Apple" above the username form
// on the sign-in and sign-up pages, with "or" under them. Either signs them
// in, or makes their account (lib/googleSignIn.ts, lib/appleSignIn.ts), then
// on to where signing in leads. Apple's comes back by way of its own page:
// when it didn't work, the address says so (?apple=failed)
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { afterSignIn, errorMessages } from "../../lib/api";
import { signInWithGoogle } from "../../lib/googleSignIn";
import { orOffline } from "../../lib/offline";
import { useAuth } from "../../store/auth";
import AppleButton from "./AppleButton";
import GoogleButton from "./GoogleButton";

type Props = {
  // what went wrong, said where the page says its other problems
  onError: (message: string) => void;
  // while the server checks Google's answer
  onBusy: (busy: boolean) => void;
};

export default function SignInWith({ onError, onBusy }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signedIn = useAuth((s) => s.signedIn);
  const appleFailed = params.get("apple") === "failed";
  useEffect(() => {
    if (appleFailed) onError("Apple sign-in didn't work. Try again.");
    // onError is the page's own setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appleFailed]);

  const withGoogle = async (credential: string) => {
    onError("");
    onBusy(true);
    try {
      const result = await signInWithGoogle(credential);
      if (result.ok) {
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
      {/* the two a pair, closer together than to the form */}
      <div className="flex flex-col gap-2">
        <GoogleButton text="continue_with" onCredential={withGoogle} />
        <AppleButton next={afterSignIn(params)} />
      </div>
      <p className="flex items-center gap-3 font-mono text-[0.8rem] text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        or
      </p>
    </div>
  );
}

// Signing in with Google (server src/auth/googleSignIn.ts). Google's own
// script draws its button and hands back a signed token when someone picks
// their account; the server checks it with Google before letting them in.
// The script is only fetched on the pages that show the button.
import { apiFetch } from "./api";

// the OAuth client ID (Google Cloud, Google Auth Platform, Clients). Not a
// secret: it's in every page with the button
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "552457597915-mqhe0847l0rs50bfhk27bclo3f76ir4v.apps.googleusercontent.com";

// the parts of Google's script used here
export type GoogleId = {
  initialize: (options: {
    client_id: string;
    callback: (answer: { credential: string }) => void;
    ux_mode?: "popup";
  }) => void;
  renderButton: (box: HTMLElement, options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

// Google's script, fetched once. Fails when it can't be had (no signal, or a
// blocker): the page then says to use the username form instead
export function loadGoogle(): Promise<GoogleId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google's script didn't start"));
    };
    script.onerror = () => {
      // tried again the next time a page asks
      loading = null;
      reject(new Error("Google's script couldn't be fetched"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

// the token from the button, to sign in (200) or make the account (201)
export const signInWithGoogle = (credential: string) =>
  apiFetch("/api/auth/google", { method: "POST", body: { credential } });

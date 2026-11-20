/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // Cloudflare Turnstile, before live price checks (lib/turnstile.ts)
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  // the Google OAuth client ID; lib/googleSignIn.ts has the live one
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Signing in with Apple on the website (server src/auth/appleSignIn.ts and
// authController.ts appleReturn). A press goes to Apple's own sign-in page;
// Apple sends the browser back to the API with a form holding a token it
// signed, and the API signs them in and moves them on to where they were
// going. No popup and no script of Apple's: it works the same in a browser
// and in the Android app.
//
// Before leaving, the visit leaves a one-time number (nonce) in a cookie and
// sends Apple the same number, which Apple writes into the token: the API
// lets in only a token with this browser's own number.

// the website's Services ID (Apple Developer, Identifiers), and the address
// Apple sends people back to, as registered for it there
const APPLE_WEB_ID = "xyz.mangatracker.web";
const RETURN_URL = "https://mangatracker.xyz/api/auth/apple/return";
// the cookie the API reads it from (authController.ts APPLE_NONCE_COOKIE)
const NONCE_COOKIE = "apple_nonce";

const randomHex = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

// to Apple's page; back signed in, on to `next` (a path on this site)
export function continueWithApple(next: string) {
  const nonce = randomHex();
  // sent with Apple's form, a post from another site: so SameSite=None,
  // and only to the one address that reads it, for ten minutes
  document.cookie = `${NONCE_COOKIE}=${nonce}; Path=/api/auth/apple; Max-Age=600; Secure; SameSite=None`;
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.search = new URLSearchParams({
    client_id: APPLE_WEB_ID,
    redirect_uri: RETURN_URL,
    response_type: "code id_token",
    // their name and email come back in a form, the only way Apple sends them
    response_mode: "form_post",
    scope: "name email",
    state: next,
    nonce,
  }).toString();
  window.location.assign(url);
}

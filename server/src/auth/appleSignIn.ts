// Signing in with Apple, from the iPhone app or the website: Apple hands
// over an identity token it signed, and it's checked here before anyone is
// let in. Its signature against Apple's published keys, that it came from
// Apple, hasn't run out, and was made for us: the app's bundle IDs, or for
// the website its Services ID and the one-time number (nonce) the visit
// started with. A token made for anyone else is turned away.
//
// Kept: the Apple account's ID ("sub"), the same for that person in this
// app for good. Apple says someone's name only the first time they sign in,
// and to the app, not in the token: the app sends it along, and it's used
// once for the username. The email (their own, or an Apple relay address
// that forwards to it) becomes a new account's email, confirmed: Apple
// checked it.
import { createRemoteJWKSet, jwtVerify } from "jose";
import config from "../config/config.js";

const APPLE = "https://appleid.apple.com";
const keys = createRemoteJWKSet(new URL(`${APPLE}/auth/keys`));

type AppleAccount = {
  appleId: string;
  email: string | null;
};

// the Apple account, or null for a token that isn't good. `webNonce`: the
// token came back to the website, which asked with that nonce
async function accountOf(
  token: string,
  webNonce?: string,
): Promise<AppleAccount | null> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: APPLE,
      audience:
        webNonce === undefined
          ? config.APPLE_BUNDLE_IDS.split(",").map((id) => id.trim())
          : config.APPLE_WEB_ID,
    });
    if (!payload.sub) return null;
    if (webNonce !== undefined && (!webNonce || payload.nonce !== webNonce))
      return null;
    const email =
      typeof payload.email === "string" &&
      (payload.email_verified === true || payload.email_verified === "true")
        ? payload.email.toLowerCase()
        : null;
    return { appleId: payload.sub, email };
  } catch {
    return null;
  }
}

// one object, so the tests can put a stand-in in place of Apple
export const appleSignIn = { accountOf };

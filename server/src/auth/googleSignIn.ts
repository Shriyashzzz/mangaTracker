// Signing in with Google: the button on the sign-in and sign-up pages hands
// the page a token Google signed, and it's checked here before anyone is
// let in. Google's own library checks the signature, that it hasn't run out,
// and that it was made for this site (our client ID): a token made for any
// other app is turned away.
//
// Kept: the Google account's ID ("sub"), the same for that account for
// good. Its name is used once, to make a new account's username ("Sarah Lee"
// signs up as sarahlee), and isn't kept as a name. Its email, when Google
// says it's verified, becomes a new account's email, confirmed: for reset
// links, and the weekly email once they say yes to it on the site.
import { OAuth2Client } from "google-auth-library";
import config from "../config/config.js";

const client = new OAuth2Client();

type GoogleAccount = {
  googleId: string;
  name: string | null;
  // only when Google says it's verified, in lowercase as every email is kept
  email: string | null;
};

// the Google account, or null for a token that isn't good (forged, expired,
// or made for another app)
async function accountOf(token: string): Promise<GoogleAccount | null> {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;
    return {
      googleId: payload.sub,
      name: payload.name ?? null,
      email:
        payload.email && payload.email_verified
          ? payload.email.toLowerCase()
          : null,
    };
  } catch {
    return null;
  }
}

// one object, so the tests can put a stand-in in place of Google
export const googleSignIn = { accountOf };

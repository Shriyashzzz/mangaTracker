// Signing in with Google: the button on the sign-in and sign-up pages hands
// the page a token Google signed, and it's checked here before anyone is
// let in. Google's own library checks the signature, that it hasn't run out,
// and that it was made for this site (our client ID): a token made for any
// other app is turned away.
//
// All that's kept is the Google account's ID ("sub"), the same for that
// account for good. Its email and name are in the token too, but they're
// never saved: the account's email stays one its reader chooses to add.
import { OAuth2Client } from "google-auth-library";
import config from "../config/config.js";

const client = new OAuth2Client();

// the Google account's ID, or null for a token that isn't good (forged,
// expired, or made for another app)
async function googleIdOf(token: string): Promise<string | null> {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload()?.sub ?? null;
  } catch {
    return null;
  }
}

// one object, so the tests can put a stand-in in place of Google
export const googleSignIn = { googleIdOf };

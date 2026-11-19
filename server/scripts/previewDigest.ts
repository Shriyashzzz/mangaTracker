// What a reader's weekly email would say right now, printed here. Nothing is
// sent, and nothing is recorded as sent.
//
//   npx tsx scripts/previewDigest.ts <username>          the plain-text email
//   npx tsx scripts/previewDigest.ts <username> --html   its HTML instead
//                                                        (pipe it to a file
//                                                        and open it)
//
// It reads the database DATABASE_URL points at, and only reads. A reader
// doesn't need the weekly email switched on to be previewed. It leaves out
// what they've already been mailed, as a real one would.
import { prisma } from "../src/config/prisma.js";
import { digestFor } from "../src/digest/digestData.js";
import { digestMail } from "../src/digest/digestEmail.js";
import { isEmpty } from "../src/digest/digestRules.js";
import type { Prefs } from "../src/models/userQueries.js";

const [username, flag] = process.argv.slice(2);
if (!username) {
  console.error("Usage: npx tsx scripts/previewDigest.ts <username> [--html]");
  process.exit(1);
}
const user = await prisma.user.findUnique({
  where: { username },
  select: { id: true, username: true, prefs: true, emailCode: true },
});
if (!user) {
  console.error(`No account called ${username}.`);
  process.exit(1);
}
const digest = await digestFor(user);
if (isEmpty(digest)) {
  console.log("No news for them right now: no email would be sent.");
} else {
  const mail = digestMail(
    {
      username: user.username,
      code: user.emailCode ?? "preview-only",
      country: (user.prefs as Prefs | null)?.country === "ca" ? "ca" : "us",
    },
    digest,
  );
  console.log(
    flag === "--html" ? mail.html : `${mail.subject}\n\n${mail.text}`,
  );
}
await prisma.$disconnect();
process.exit(0);

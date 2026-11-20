// Sends the weekly email: once an hour it looks for readers who asked for
// it, confirmed their address and haven't had one for a week, and mails each
// one who has news. No news, no email: they're looked at again tomorrow.
//
// Runs on the live site only, unless EMAIL_DIGEST=on (a laptop shares the
// site's mail keys); EMAIL_DIGEST=off stops it anywhere.
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import { DAY_MS, startEvery, triedLately } from "../collector/fillShared.js";
import sendEmail from "../util/email/sendEmail.js";
import { digestFor } from "./digestData.js";
import { confirmMail, digestMail, type Mail } from "./digestEmail.js";
import { isEmpty, keysOf } from "./digestRules.js";
import userQueries, { type Prefs } from "../models/userQueries.js";

const FROM = "updates@mangatracker.xyz";
const WEEK_MS = 7 * DAY_MS;
const HOUR_MS = 60 * 60_000;
// sent in North America's daytime: 14:00 to 23:59 UTC is 9am Eastern to
// 4pm Pacific
const FIRST_HOUR_UTC = 14;

const send = (to: string, mail: Mail) => sendEmail({ from: FROM, to, ...mail });

const sendConfirmMail = (reader: {
  to: string;
  username: string;
  code: string;
}) => send(reader.to, confirmMail(reader));

// Switches the weekly email on for an account and mails its confirm link,
// if its address still needs one (sign-up with an address, and Settings).
// False when the mail didn't go: the setting is saved either way, and the
// page can say the link wasn't sent, so nobody waits for it
export async function mailConfirmLink(userId: number) {
  const user = await userQueries.setWeeklyEmail(userId, true);
  if (!user?.recoveryEmail || !user.emailCode || user.emailConfirmed)
    return true;
  return sendConfirmMail({
    to: user.recoveryEmail,
    username: user.username,
    code: user.emailCode,
  })
    .then(() => true)
    .catch((e: Error) => {
      console.error("confirm email failed:", e.message);
      return false;
    });
}

export const digestSwitchOn = () =>
  config.EMAIL_DIGEST !== "off" &&
  Boolean(config.SMTP_USER) &&
  (config.EMAIL_DIGEST === "on" || config.ENV === "PROD");

// readers with nothing to say, or whose mail failed: left alone for a day
const looked = triedLately(DAY_MS);

// One run: up to `most` emails. What happened comes back, for the log and
// the tests
export async function sendDueDigests(
  now = new Date(),
  most = config.DIGEST_PER_RUN,
) {
  const due = await prisma.user.findMany({
    where: {
      weeklyEmail: true,
      emailConfirmed: true,
      recoveryEmail: { not: null },
      emailCode: { not: null },
      OR: [
        { digestSentAt: null },
        { digestSentAt: { lt: new Date(now.getTime() - WEEK_MS) } },
      ],
    },
    // whoever has waited longest first
    orderBy: [{ digestSentAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    select: {
      id: true,
      username: true,
      recoveryEmail: true,
      emailCode: true,
      prefs: true,
    },
  });
  let sent = 0;
  let quiet = 0;
  let failed = 0;
  for (const user of due) {
    if (sent >= most) break;
    const key = String(user.id);
    if (!looked.isDue(key, now.getTime())) continue;
    try {
      const digest = await digestFor(user, now);
      if (isEmpty(digest)) {
        looked.mark(key, now.getTime());
        quiet++;
        continue;
      }
      await send(
        user.recoveryEmail!,
        digestMail(
          {
            username: user.username,
            code: user.emailCode!,
            country:
              (user.prefs as Prefs | null)?.country === "ca" ? "ca" : "us",
          },
          digest,
        ),
      );
      // told: none of it is mailed again, and their week starts over
      await prisma.$transaction([
        prisma.digestItem.deleteMany({
          where: { userId: user.id, item: { in: keysOf(digest) } },
        }),
        prisma.digestItem.createMany({
          data: keysOf(digest).map((item) => ({
            userId: user.id,
            item,
            sentAt: now,
          })),
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { digestSentAt: now },
        }),
      ]);
      sent++;
    } catch (e) {
      looked.mark(key, now.getTime());
      failed++;
      console.error(`weekly email for user ${user.id} failed:`, e);
    }
  }
  return { due: due.length, sent, quiet, failed };
}

// for the tests: forgets who was looked at
export const forgetLooked = () => looked.clear();

export function startDigestSender() {
  if (!digestSwitchOn()) return;
  startEvery(
    "weekly email",
    async () => {
      if (new Date().getUTCHours() < FIRST_HOUR_UTC) return;
      const result = await sendDueDigests();
      if (result.sent || result.failed)
        console.log(
          `weekly email: ${result.sent} sent, ${result.failed} failed, ${result.quiet} with no news`,
        );
    },
    { everyMs: HOUR_MS, firstAfterMs: 10 * 60_000 },
  );
}

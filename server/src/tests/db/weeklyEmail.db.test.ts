// The weekly email with a real database: switching it on, confirming the
// address, what's mailed and that nothing is mailed twice, and the
// unsubscribe link. No email is really sent: the test keeps what would have
// gone out.
import request from "supertest";
import { app } from "../../app.js";
import transporter from "../../config/smtp.js";
import { forgetLooked, sendDueDigests } from "../../digest/digestSender.js";
import userQueries from "../../models/userQueries.js";
import { volumesKey } from "../../prices/volumesKey.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

type Mail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
};
const sent: Mail[] = [];
(transporter as { sendMail: unknown }).sendMail = async (mail: Mail) => {
  sent.push(mail);
};

const SERIES = "Weekly Email Test Series";
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const day = (offset: number) =>
  new Date(now.getTime() + offset * DAY).toISOString().slice(0, 10);

beforeEach(async () => {
  sent.length = 0;
  forgetLooked();
  await emptyDb();
  // the series' saved list: three volumes, the third out five days ago
  await prisma.seriesVolumes.upsert({
    where: { key: volumesKey(SERIES) },
    update: {},
    create: {
      key: volumesKey(SERIES),
      volumes: [-400, -200, -5].map((offset, i) => ({
        volume: i + 1,
        isbn13: `979000000000${i}`,
        title: `${SERIES}, Vol. ${i + 1}`,
        published: day(offset),
      })),
    },
  });
});
afterAll(async () => {
  await prisma.seriesVolumes.deleteMany({ where: { key: volumesKey(SERIES) } });
  await closeDb();
});

const EMAIL = "reader@example.com";
// a signed-in reader, who owns the first two volumes of the series
async function signedIn(email: string | null = EMAIL) {
  // made directly: sign-up only lets a handful through an hour
  const id = (await userQueries.addUser("reader", "a long password"))!;
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "reader", password: "a long password" });
  const user = { id };
  if (email) await userQueries.updateAccount(user.id, { recoveryEmail: email });
  await prisma.manga.create({
    data: { userId: user.id, name: SERIES, volumesOwned: 2 },
  });
  return { agent, id: user.id };
}
const switchOn = (agent: ReturnType<typeof request.agent>, on = true) =>
  agent.post("/api/account/weekly-email").send({ on });
const lastMail = () => {
  const mail = sent.at(-1);
  if (!mail) throw new Error("No email was sent");
  return mail;
};
// the code in the last email's link of this kind
const codeIn = (kind: "confirm" | "unsubscribe") =>
  lastMail().html.match(new RegExp(`/email/${kind}/([\\w-]+)"`))?.[1] ?? "";

test("it needs an email saved first", async () => {
  const { agent } = await signedIn(null);
  const res = await switchOn(agent);
  expect(res.status).toBe(400);
  expect(sent).toEqual([]);
});

test("switching it on mails a confirm link, and nothing weekly until it's pressed", async () => {
  const { agent } = await signedIn();

  const res = await switchOn(agent);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ weeklyEmail: true, emailConfirmed: false });
  expect(sent.map((m) => [m.to, m.subject])).toEqual([
    [EMAIL, "Confirm your email for Manga Tracker"],
  ]);

  // not confirmed: the weekly job passes them by
  expect(await sendDueDigests(now)).toMatchObject({ due: 0, sent: 0 });

  const confirmed = await request(app).post(
    `/api/email/confirm/${codeIn("confirm")}`,
  );
  expect(confirmed.status).toBe(204);
  const account = await agent.get("/api/account");
  expect(account.body).toMatchObject({
    weeklyEmail: true,
    emailConfirmed: true,
  });
});

test("a confirmed reader is mailed their news once, and not again", async () => {
  const { agent, id } = await signedIn();
  await switchOn(agent);
  await request(app).post(`/api/email/confirm/${codeIn("confirm")}`);
  sent.length = 0;

  expect(await sendDueDigests(now)).toMatchObject({ sent: 1, failed: 0 });
  const mail = lastMail();
  expect(mail.to).toBe(EMAIL);
  expect(mail.subject).toBe(`${SERIES} Vol. 3 is out`);
  expect(mail.html).toContain(`/details/`);
  expect(mail.text).toContain("OUT NOW");
  // every link is to the site: no store is linked from an email
  expect(mail.html).not.toMatch(/amazon|ebay|booksamillion/i);
  expect(codeIn("unsubscribe")).toMatch(/^[\w-]{20,40}$/);

  const series = await prisma.manga.findFirstOrThrow({ where: { userId: id } });
  const told = await prisma.digestItem.findMany({ where: { userId: id } });
  expect(told.map((t) => t.item)).toEqual([`out:${series.id}:3`]);

  // the same hour, the next day, and a week on: nothing new to say
  expect(await sendDueDigests(now)).toMatchObject({ sent: 0 });
  forgetLooked();
  const nextWeek = new Date(now.getTime() + 8 * DAY);
  expect(await sendDueDigests(nextWeek)).toMatchObject({ sent: 0, quiet: 1 });
  expect(sent).toHaveLength(1);
});

test("a reader with no news gets no email", async () => {
  const { agent, id } = await signedIn();
  // they own all three: nothing is new for them
  await prisma.manga.updateMany({
    where: { userId: id },
    data: { volumesOwned: 3 },
  });
  await switchOn(agent);
  await request(app).post(`/api/email/confirm/${codeIn("confirm")}`);
  sent.length = 0;

  expect(await sendDueDigests(now)).toMatchObject({ sent: 0, quiet: 1 });
  expect(sent).toEqual([]);
});

test("the unsubscribe link works without signing in, and stops the email", async () => {
  const { agent } = await signedIn();
  await switchOn(agent);
  await request(app).post(`/api/email/confirm/${codeIn("confirm")}`);
  await sendDueDigests(now);
  const code = codeIn("unsubscribe");

  // as an inbox's one-click button sends it: a form post, no cookies
  const res = await request(app)
    .post(`/api/email/unsubscribe/${code}`)
    .type("form")
    .send("List-Unsubscribe=One-Click");
  expect(res.status).toBe(204);
  const account = await agent.get("/api/account");
  expect(account.body.weeklyEmail).toBe(false);

  // a code nobody has
  const unknown = await request(app).post(
    "/api/email/unsubscribe/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );
  expect(unknown.status).toBe(404);
});

test("a new address has to be confirmed again, and the old links stop", async () => {
  const { agent } = await signedIn();
  await switchOn(agent);
  const oldCode = codeIn("confirm");
  await request(app).post(`/api/email/confirm/${oldCode}`);
  sent.length = 0;

  const changed = await agent
    .patch("/api/account")
    .send({ recoveryEmail: "new@example.com" });
  expect(changed.body).toMatchObject({
    weeklyEmail: true,
    emailConfirmed: false,
  });
  // the new address is asked, at once
  expect(sent.map((m) => m.to)).toEqual(["new@example.com"]);
  expect(codeIn("confirm")).not.toBe(oldCode);
  const old = await request(app).post(`/api/email/confirm/${oldCode}`);
  expect(old.status).toBe(404);
  expect(await sendDueDigests(now)).toMatchObject({ due: 0 });

  // taking the address away switches the weekly email off
  const removed = await agent
    .patch("/api/account")
    .send({ recoveryEmail: null });
  expect(removed.body).toMatchObject({ weeklyEmail: false });
});

test("at most so many a run, and each reader once a week", async () => {
  // two confirmed readers, both with news
  const ids: number[] = [];
  for (const name of ["first", "second"]) {
    const id = (await userQueries.addUser(name, "a long password"))!;
    await userQueries.updateAccount(id, {
      recoveryEmail: `${name}@example.com`,
    });
    await userQueries.setWeeklyEmail(id, true);
    await prisma.user.update({ where: { id }, data: { emailConfirmed: true } });
    await prisma.manga.create({
      data: { userId: id, name: SERIES, volumesOwned: 2 },
    });
    ids.push(id);
  }
  // one a run: the other waits for the next
  expect(await sendDueDigests(now, 1)).toMatchObject({ due: 2, sent: 1 });
  expect(await sendDueDigests(now, 1)).toMatchObject({ due: 1, sent: 1 });
  expect(sent).toHaveLength(2);
  // three days on: neither is due; eight days on, both are again
  forgetLooked();
  expect(
    await sendDueDigests(new Date(now.getTime() + 3 * DAY), 10),
  ).toMatchObject({ due: 0 });
  forgetLooked();
  const nextWeek = await sendDueDigests(new Date(now.getTime() + 8 * DAY), 10);
  expect(nextWeek.due).toBe(2);
});

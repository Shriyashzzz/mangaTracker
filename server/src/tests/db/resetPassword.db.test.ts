// Resetting a forgotten password with a real database: asking by email, the
// link's token, and choosing the new password. No email is really sent: the
// test keeps what would have gone out and reads the link from it.
import request from "supertest";
import { app } from "../../app.js";
import transporter from "../../config/smtp.js";
import userQueries from "../../models/userQueries.js";
import { closeDb, emptyDb, prisma } from "./testDb.js";

type Mail = { to: string; from: string; html: string };
const sent: Mail[] = [];
(transporter as { sendMail: unknown }).sendMail = async (mail: Mail) => {
  sent.push(mail);
};

beforeEach(async () => {
  sent.length = 0;
  await emptyDb();
});
afterAll(closeDb);

const EMAIL = "reader@example.com";
// an account with a recovery email saved, as Settings saves it
const addReader = async (username = "reader", email = EMAIL) => {
  const id = await userQueries.addUser(username, "the old password");
  await userQueries.updateAccount(id!, { recoveryEmail: email });
  return id!;
};
const ask = (email: unknown) =>
  request(app).post("/api/auth/initiatePassReset").send({ email });
const choose = (token: string, newPassword: string, confirmPassword: string) =>
  request(app)
    .post(`/api/auth/resetPassword/${token}`)
    .send({ newPassword, confirmPassword });
const signIn = (password: string) =>
  request(app).post("/api/auth/login").send({ username: "reader", password });
// the first email that went out
const firstMail = () => {
  const mail = sent[0];
  if (!mail) throw new Error("No email was sent");
  return mail;
};
// the token in its link
const tokenSent = () =>
  firstMail().html.match(/\/reset-password\/([a-f0-9]+)"/)?.[1] ?? "";

test("an email with an account and one without get the same answer", async () => {
  await addReader();

  const known = await ask(EMAIL);
  const unknown = await ask("nobody@example.com");

  expect(known.status).toBe(200);
  expect(unknown.status).toBe(200);
  expect(unknown.body).toEqual(known.body);
  // but only the real account is written to
  expect(sent.map((mail) => mail.to)).toEqual([EMAIL]);
});

test("the email is found however its capitals were typed", async () => {
  await addReader();
  await ask("Reader@Example.com").expect(200);
  expect(sent).toHaveLength(1);
});

test("an email belongs to one account, whatever its capitals", async () => {
  await addReader();
  // signing up with it
  const signUp = await request(app)
    .post("/api/auth/signup")
    .send({ username: "second", password: "a good password", email: EMAIL });
  expect(signUp.status).toBe(409);
  expect(signUp.body.error[0].msg).toBe(
    "That email is already on another account.",
  );
  // saving it in settings, from another account
  const other = request.agent(app);
  await other
    .post("/api/auth/signup")
    .send({ username: "third", password: "a good password" })
    .expect(201);
  const saved = await other
    .patch("/api/account")
    .send({ recoveryEmail: "READER@example.com" });
  expect(saved.status).toBe(409);
  // their own email saved again is fine, and is kept in lowercase
  const own = await other
    .patch("/api/account")
    .send({ recoveryEmail: "Third@Example.com" });
  expect(own.status).toBe(200);
  expect(own.body.recoveryEmail).toBe("third@example.com");
  await other
    .patch("/api/account")
    .send({ recoveryEmail: "third@example.com" })
    .expect(200);
});

test("something that isn't an email is refused", async () => {
  const res = await ask("not an email");
  expect(res.status).toBe(400);
  expect(res.body.error[0].msg).toBe(
    "That doesn't look like an email address.",
  );
});

test("the email has a working link, the name, and no leftover blanks", async () => {
  await addReader();
  await ask(EMAIL);

  const { html, from } = firstMail();
  expect(tokenSent()).toHaveLength(64);
  expect(html).toContain("Hi reader,");
  expect(html).toContain("15 minutes");
  expect(html).not.toContain("{{");
  expect(html).not.toContain('href="{');
  expect(from).toBe('"Manga Tracker" <account-security@mangatracker.xyz>');
});

test("the database keeps the token's hash, never the token", async () => {
  await addReader();
  await ask(EMAIL);

  const user = await prisma.user.findUniqueOrThrow({
    where: { username: "reader" },
  });
  expect(user.reset_token).toHaveLength(64);
  expect(user.reset_token).not.toBe(tokenSent());
});

test("the link sets a new password, once, and signs other devices out", async () => {
  await addReader();
  // signed in somewhere before the reset
  const device = request.agent(app);
  await device
    .post("/api/auth/login")
    .send({ username: "reader", password: "the old password" })
    .expect(200);
  await ask(EMAIL);
  const token = tokenSent();

  await request(app).get(`/api/auth/verifytoken/${token}`).expect(200);
  await choose(token, "a new password", "a new password").expect(200);

  await signIn("the old password").expect(401);
  await signIn("a new password").expect(200);
  // the link is used up
  await request(app).get(`/api/auth/verifytoken/${token}`).expect(410);
  await choose(token, "another password", "another password").expect(410);
  // and the device signed in with the old password no longer is
  const me = await device.get("/api/auth/me");
  expect(me.body.user ?? null).toBeNull();
});

test("two passwords that differ, or a short one, change nothing", async () => {
  await addReader();
  await ask(EMAIL);
  const token = tokenSent();

  const differ = await choose(token, "a new password", "a mew password");
  expect(differ.status).toBe(400);
  const short = await choose(token, "abc", "abc");
  expect(short.status).toBe(400);
  await signIn("the old password").expect(200);
});

test("a token that was never sent, or has run out, is refused", async () => {
  await addReader();
  await request(app).get("/api/auth/verifytoken/abc123").expect(410);

  await ask(EMAIL);
  await prisma.user.update({
    where: { username: "reader" },
    data: { reset_token_expiry: Date.now() - 1000 },
  });
  await request(app).get(`/api/auth/verifytoken/${tokenSent()}`).expect(410);
  await choose(tokenSent(), "a new password", "a new password").expect(410);
});

test("an email given on signing up is where the reset link goes", async () => {
  await request(app)
    .post("/api/auth/signup")
    .send({ username: "reader", password: "the old password", email: EMAIL })
    .expect(201);
  await ask(EMAIL).expect(200);
  expect(sent.map((mail) => mail.to)).toEqual([EMAIL]);
});

test("signing up without an email still works, and a bad one is refused", async () => {
  await request(app)
    .post("/api/auth/signup")
    .send({ username: "noemail", password: "a good password" })
    .expect(201);
  const bad = await request(app)
    .post("/api/auth/signup")
    .send({ username: "bademail", password: "a good password", email: "nope" });
  expect(bad.status).toBe(400);
  expect(bad.body.error[0].msg).toBe(
    "That doesn't look like an email address.",
  );
});

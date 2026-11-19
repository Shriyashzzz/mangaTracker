// The weekly email and the one that confirms an address, as they're sent:
// a subject, the HTML, and the same in plain words. The look is the reset
// email's (util/email/emailTemplate.ts): paper, an ink border, one red
// button.
//
// Every link goes to the site, never to a store: stores' affiliate rules
// (Amazon's above all) don't allow their links in email. The price page a
// link opens has the store buttons.
import config from "../config/config.js";
import { site } from "../util/email/emailTemplate.js";
import { MOST_PER_KIND, type Digest, type ReleaseItem } from "./digestRules.js";

export type Mail = {
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

// a reader's own words (a series' name is theirs to type) never as HTML
const esc = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// "Nov 24"
const dayText = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const FONT = "font-family:Arial, Helvetica, sans-serif;";
const INK = "#1d1a16";
const SOFT = "#4a443b";
const FAINT = "#6f6758";
const RED = "#963d31";

// the page every email of ours is drawn on
const page = (title: string, preview: string, card: string, footer: string) =>
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3eee2;">
  <!-- shown beside the subject in the inbox, hidden in the email itself -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#f3eee2;">${esc(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3eee2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td style="padding:0 4px 14px 4px; font-family:Impact, 'Arial Narrow', Arial, sans-serif; font-size:24px; line-height:1; letter-spacing:1px; text-transform:uppercase; color:${INK};">
              Manga Tracker
            </td>
          </tr>
          <tr>
            <td style="background-color:#fbf8f0; border:3px solid ${INK}; padding:28px 26px;">
${card}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 4px 0 4px; ${FONT} font-size:12px; line-height:1.6; color:${FAINT};">
${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const heading = (text: string) =>
  `              <h1 style="margin:0 0 14px 0; font-family:Georgia, 'Times New Roman', serif; font-size:26px; line-height:1.2; font-weight:bold; color:${INK};">${esc(text)}</h1>`;
const paragraph = (html: string) =>
  `              <p style="margin:0 0 18px 0; ${FONT} font-size:16px; line-height:1.55; color:${SOFT};">${html}</p>`;
const button = (label: string, url: string) =>
  `              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px 0;">
                <tr>
                  <td align="center" bgcolor="#b14a3c" style="background-color:#b14a3c; border:2px solid ${INK};">
                    <a href="${url}" target="_blank" style="display:inline-block; padding:13px 24px; ${FONT} font-size:16px; font-weight:bold; color:#fbf8f0; text-decoration:none;">${esc(label)}</a>
                  </td>
                </tr>
              </table>`;

// one kind of news: a small heading, then a line each
const section = (title: string, rows: string[]) =>
  rows.length
    ? `              <h2 style="margin:22px 0 4px 0; padding-bottom:6px; border-bottom:2px solid ${INK}; font-family:Impact, 'Arial Narrow', Arial, sans-serif; font-size:15px; letter-spacing:1px; text-transform:uppercase; font-weight:normal; color:${INK};">${esc(title)}</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows.join("\n")}
              </table>`
    : "";
// a line of news: what it is (a link to its page) and a word beside it
const row = (name: string, url: string, beside: string) =>
  `                <tr>
                  <td style="padding:10px 0; border-bottom:1px dashed #d6ccb7; ${FONT} font-size:16px; line-height:1.4; color:${INK};">
                    <a href="${url}" target="_blank" style="color:${INK}; font-weight:bold; text-decoration:underline;">${name}</a>
                  </td>
                  <td align="right" style="padding:10px 0 10px 12px; border-bottom:1px dashed #d6ccb7; ${FONT} font-size:14px; line-height:1.4; color:${SOFT}; white-space:nowrap;">${beside}</td>
                </tr>`;
// a line of news whose detail is too long to sit beside it (a price, its
// store and the usual price): the detail goes underneath, so a phone never
// has to scroll sideways
const rowWithDetail = (name: string, url: string, detail: string) =>
  `                <tr>
                  <td colspan="2" style="padding:10px 0; border-bottom:1px dashed #d6ccb7; ${FONT} font-size:16px; line-height:1.4; color:${INK};">
                    <a href="${url}" target="_blank" style="color:${INK}; font-weight:bold; text-decoration:underline;">${name}</a>
                    <div style="padding-top:3px; font-size:14px; color:${SOFT};">${detail}</div>
                  </td>
                </tr>`;
// "and 4 more on your shelf"
const moreRow = (count: number, url: string, where: string) =>
  `                <tr>
                  <td colspan="2" style="padding:10px 0 0 0; ${FONT} font-size:14px; color:${SOFT};">
                    <a href="${url}" target="_blank" style="color:${RED};">and ${count} more ${where}</a>
                  </td>
                </tr>`;

const bookOf = (item: ReleaseItem) => `${item.series} ${item.book}`;

// the subject names the first thing in it: "Vagabond VIZBIG 13 is out, and
// 2 more for your shelf"
export function digestSubject(digest: Digest) {
  const count = digest.out.length + digest.soon.length + digest.drops.length;
  const rest = count > 1 ? `, and ${count - 1} more for your shelf` : "";
  const [out] = digest.out;
  if (out) return `${bookOf(out)} is out${rest}`;
  const [soon] = digest.soon;
  if (soon) return `${bookOf(soon)} comes out ${dayText(soon.day)}${rest}`;
  const drop = digest.drops[0]!;
  return `${drop.title} is ${money(drop.cents)}${rest}`;
}

// the weekly email for one reader. `code` is the code in their links
export function digestMail(
  reader: { username: string; code: string },
  digest: Digest,
): Mail {
  const home = site();
  const seriesUrl = (item: ReleaseItem) => `${home}/details/${item.mangaId}`;
  const unsubscribeUrl = `${home}/email/unsubscribe/${reader.code}`;
  const shown = <T>(items: T[]) => items.slice(0, MOST_PER_KIND);
  const extra = (items: unknown[]) => Math.max(0, items.length - MOST_PER_KIND);

  const outRows = shown(digest.out).map((item) =>
    row(esc(bookOf(item)), seriesUrl(item), `out ${dayText(item.day)}`),
  );
  if (extra(digest.out))
    outRows.push(
      moreRow(extra(digest.out), `${home}/new-releases`, "on your shelf"),
    );
  const soonRows = shown(digest.soon).map((item) =>
    row(esc(bookOf(item)), seriesUrl(item), dayText(item.day)),
  );
  if (extra(digest.soon))
    soonRows.push(moreRow(extra(digest.soon), `${home}/calendar`, "coming"));
  const dropRows = shown(digest.drops).map((item) =>
    rowWithDetail(
      esc(item.title),
      `${home}/prices/${item.isbn13}`,
      `<strong style="color:${RED};">${money(item.cents)}</strong> at ${esc(item.store)}, usually ${money(item.usualCents)}`,
    ),
  );
  if (extra(digest.drops))
    dropRows.push(
      moreRow(extra(digest.drops), `${home}/to-buy`, "on your To buy list"),
    );

  const subject = digestSubject(digest);
  const card = [
    heading("New for your shelf"),
    `              <p style="margin:0; ${FONT} font-size:16px; line-height:1.55; color:${SOFT};">Hi ${esc(reader.username)}, here's what changed this week.</p>`,
    section("Out now", outRows),
    section("Coming soon", soonRows),
    section("Cheaper than usual", dropRows),
    `              <div style="height:24px; line-height:24px; font-size:0;">&nbsp;</div>`,
    button("Open my shelf", `${home}/shelf`),
  ]
    .filter(Boolean)
    .join("\n");
  const footer = `              You get this because you switched on the weekly email in your Manga Tracker settings. It only comes when there's news.<br>
              <a href="${unsubscribeUrl}" target="_blank" style="color:${FAINT}; text-decoration:underline;">Unsubscribe</a> · Prices were checked in the last few days and can change.`;

  const lines = [
    `Hi ${reader.username}, here's what changed this week.`,
    ...textSection(
      "OUT NOW",
      digest.out.map(
        (i) => `${bookOf(i)}, out ${dayText(i.day)}\n  ${seriesUrl(i)}`,
      ),
    ),
    ...textSection(
      "COMING SOON",
      digest.soon.map(
        (i) => `${bookOf(i)}, ${dayText(i.day)}\n  ${seriesUrl(i)}`,
      ),
    ),
    ...textSection(
      "CHEAPER THAN USUAL",
      digest.drops.map(
        (i) =>
          `${i.title}: ${money(i.cents)} at ${i.store}, usually ${money(i.usualCents)}\n  ${home}/prices/${i.isbn13}`,
      ),
    ),
    "",
    `Your shelf: ${home}/shelf`,
    "",
    "You get this because you switched on the weekly email in your Manga Tracker settings.",
    `Unsubscribe: ${unsubscribeUrl}`,
  ];

  return {
    subject,
    html: page(subject, previewOf(digest), card, footer),
    text: lines.join("\n"),
    headers: unsubscribeHeaders(reader.code),
  };
}

const textSection = (title: string, rows: string[]) =>
  rows.length ? ["", title, ...rows.slice(0, MOST_PER_KIND)] : [];

// the words an inbox shows beside the subject: the second thing in it
function previewOf(digest: Digest) {
  const names = [
    ...digest.out.map((i) => `${bookOf(i)} is out`),
    ...digest.soon.map((i) => `${bookOf(i)} on ${dayText(i.day)}`),
    ...digest.drops.map((i) => `${i.title} at ${money(i.cents)}`),
  ];
  return names.slice(1, 4).join(" · ") || "From your Manga Tracker shelf.";
}

// Gmail's and Yahoo's one-click unsubscribe: a POST to our own server.
// Only when the server knows its public address (API_URL)
function unsubscribeHeaders(code: string): Record<string, string> | undefined {
  const api = config.API_URL?.replace(/\/+$/, "");
  if (!api) return undefined;
  return {
    "List-Unsubscribe": `<${api}/api/email/unsubscribe/${code}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// "Is this your address?": sent when the weekly email is switched on, and
// again when the address changes. Nothing weekly goes out until its link
// is pressed
export function confirmMail(reader: { username: string; code: string }): Mail {
  const url = `${site()}/email/confirm/${reader.code}`;
  const subject = "Confirm your email for Manga Tracker";
  const card = [
    heading("Confirm your email"),
    paragraph(
      `Hi ${esc(reader.username)}, you switched on the weekly email. Press the button so we know this address is yours.`,
    ),
    button("Yes, send it here", url),
    `              <p style="margin:18px 0 6px 0; ${FONT} font-size:13px; line-height:1.5; color:${FAINT};">Button not working? Copy this into your browser:</p>
              <p style="margin:0 0 20px 0; font-family:'Courier New', Courier, monospace; font-size:13px; line-height:1.5; word-break:break-all;"><a href="${url}" target="_blank" style="color:${RED}; text-decoration:underline;">${url}</a></p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px dashed #d6ccb7; padding-top:16px; ${FONT} font-size:14px; line-height:1.55; color:${SOFT};">
                    Didn't ask for this? Ignore this email and nothing more will come.
                  </td>
                </tr>
              </table>`,
  ].join("\n");
  const footer = `              Sent by Manga Tracker, mangatracker.xyz.`;
  return {
    subject,
    html: page(
      subject,
      "One press, and your weekly email is on.",
      card,
      footer,
    ),
    text: [
      `Hi ${reader.username}, you switched on the weekly email.`,
      "Open this link so we know this address is yours:",
      url,
      "",
      "Didn't ask for this? Ignore this email and nothing more will come.",
    ].join("\n"),
  };
}

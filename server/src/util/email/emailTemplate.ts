import config from "../../config/config.js";
import { RESET_LINK_MINUTES } from "../resetToken.js";

// where the site lives: the live one, or CLIENT_URL on your own machine
export const site = () =>
  (config.CLIENT_URL ?? "https://mangatracker.xyz").replace(/\/+$/, "");

type Props =
  | { emailType: "resetPassword"; resetToken: string; username: string }
  | { emailType: "unsubscribeNewsletter"; unsubNewsToken: string }
  | { emailType: "unsubscribeTracking"; usubTrackToken: string };

export const emailTemplate = (props: Props) => {
  if (props.emailType == "resetPassword" && Boolean(props.resetToken)) {
    const resetUrl = `${site()}/reset-password/${props.resetToken}`;
    const worksFor = `${RESET_LINK_MINUTES} minutes`;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Reset your Manga Tracker password</title>
</head>
<body style="margin:0; padding:0; background-color:#f3eee2;">
  <!-- shown beside the subject in the inbox, hidden in the email itself -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#f3eee2;">
    Pick a new password for your Manga Tracker account. The link works for ${worksFor}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3eee2;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

          <!-- the site's name -->
          <tr>
            <td style="padding:0 4px 14px 4px; font-family:Impact, 'Arial Narrow', Arial, sans-serif; font-size:24px; line-height:1; letter-spacing:1px; text-transform:uppercase; color:#1d1a16;">
              Manga Tracker
            </td>
          </tr>

          <!-- the card -->
          <tr>
            <td style="background-color:#fbf8f0; border:3px solid #1d1a16; padding:28px 26px;">

              <h1 style="margin:0 0 14px 0; font-family:Georgia, 'Times New Roman', serif; font-size:26px; line-height:1.2; font-weight:bold; color:#1d1a16;">
                Reset your password
              </h1>

              <p style="margin:0 0 12px 0; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:1.55; color:#4a443b;">
                Hi ${props.username},
              </p>
              <p style="margin:0 0 22px 0; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:1.55; color:#4a443b;">
                Someone asked to reset the password for your account. Press the button to pick a new one.
              </p>

              <!-- the button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
                <tr>
                  <td align="center" bgcolor="#b14a3c" style="background-color:#b14a3c; border:2px solid #1d1a16;">
                    <a href="${resetUrl}" target="_blank"
                       style="display:inline-block; padding:13px 24px; font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; color:#fbf8f0; text-decoration:none;">
                      Choose a new password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px 0; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#4a443b;">
                The link works for ${worksFor}, and only once.
              </p>

              <!-- the link in full, for when the button doesn't work -->
              <p style="margin:0 0 6px 0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#6f6758;">
                Button not working? Copy this into your browser:
              </p>
              <p style="margin:0 0 22px 0; font-family:'Courier New', Courier, monospace; font-size:13px; line-height:1.5; word-break:break-all;">
                <a href="${resetUrl}" target="_blank" style="color:#963d31; text-decoration:underline;">${resetUrl}</a>
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px dashed #d6ccb7; padding-top:16px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.55; color:#4a443b;">
                    Didn't ask for this? You can ignore this email. Your password stays the same.
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- the footer -->
          <tr>
            <td style="padding:16px 4px 0 4px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:1.5; color:#6f6758;">
              Sent by Manga Tracker, mangatracker.xyz. We only email about your account.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
  }
  return ""; // comfigure more types later
};

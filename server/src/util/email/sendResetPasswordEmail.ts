import { emailTemplate } from "./emailTemplate.js";
import sendEmail from "./sendEmail.js";

const sendResetPasswordEmail = async (
  resetToken: string,
  email: string,
  username: string,
): Promise<boolean> => {
  try {
    const html = emailTemplate({
      resetToken: resetToken,
      username: username,
      emailType: "resetPassword",
    });

    await sendEmail({
      from: "account-security@mangatracker.xyz",
      to: email,
      subject: "Manga Tracker Login Assistant",
      html: html,
    });
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
};
export default sendResetPasswordEmail;

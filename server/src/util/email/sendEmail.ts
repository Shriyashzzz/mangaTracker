import transporter from "../../config/smtp.js";

const isValidEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const sendEmail = async ({
  //for reference email domain will look like this `"Alert Name"<email_service_type>@mangatracker.xyz>`
  from, // eg: '<email_service_type>@mangatracker.xyz'
  to,
  subject,
  html,
  text,
  headers,
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  // the same email in plain words, for readers and filters that want it
  text?: string;
  // extra headers: the weekly email's one-click unsubscribe
  headers?: Record<string, string>;
}): Promise<boolean> => {
  if (!isValidEmail(from)) throw new Error("`from` email is not valid");
  if (!isValidEmail(to)) throw new Error("`to` email is not valid");
  if (!subject) throw new Error("subject field is Empty");
  if (!html) throw new Error("HTML field is empty");
  const formEmail = `"Manga Tracker" <${from.trim()}>`;
  const toEmail = to.trim();
  try {
    await transporter.sendMail({
      from: formEmail,
      to: toEmail,
      subject: subject,
      html: html,
      ...(text ? { text } : {}),
      ...(headers ? { headers } : {}),
    });
    return true;
  } catch (e) {
    console.log(`failed to send ${subject} email `, e);
    throw e;
  }
};

// unused function, can be used later incase if you want to send mass email without schduling jobs. Caution : doing so on a big list might block the api threads
//eslint-disable-next-line @typescript-eslint/no-unused-vars
const validateBigEmailArray = (
  emailArray: Array<string>,
  subject: string,
): Array<string> => {
  let invalidCount = 0;
  const validEmails: Array<string> = emailArray.filter((email: string) => {
    if (isValidEmail(email)) {
      return email;
    } else {
      invalidCount++;
      return false;
    }
  });
  if (invalidCount > 0)
    console.log(
      `Found ${invalidCount} invalid emails while sending ${subject} email`,
    );
  return validEmails;
};

export default sendEmail;

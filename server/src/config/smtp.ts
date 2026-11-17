import nodemailer from "nodemailer";
import config from "./config.js";

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  pool: true,
  port: 465,
  maxConnections: 2,
  maxMessages: 100,
  secure: true,
  rateLimit: 1, // one mail per rate Delta
  rateDelta: 1000, //in ms, so 1000ms = 1 seconds
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

export default transporter;

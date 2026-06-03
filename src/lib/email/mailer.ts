import nodemailer from "nodemailer";
import type { SmtpSettings } from "@/types";

export function createTransport(smtp: SmtpSettings) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

export async function sendEmail(params: {
  smtp: SmtpSettings;
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const transport = createTransport(params.smtp);
  await transport.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html.replace(/\n/g, "<br>"),
  });
}

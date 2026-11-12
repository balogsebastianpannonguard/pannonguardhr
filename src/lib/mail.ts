import "server-only";
import nodemailer from "nodemailer";

export type Attachment = { filename: string; content: string | Buffer; contentType?: string; /** Levélbe ágyazott kép azonosítója (cid:…). */ cid?: string };

export function mailAvailable() {
  const { SMTP_HOST, EMAIL_USER, EMAIL_PASS } = process.env;
  return Boolean(SMTP_HOST && EMAIL_USER && EMAIL_PASS);
}

/** Levél küldése a .env.local-ban megadott postafiókból. Hibánál a hibakódot adja vissza. */
export async function sendMail({
  to,
  subject,
  text,
  html,
  attachments,
  replyTo,
}: {
  replyTo?: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Attachment[];
}) {
  if (!mailAvailable()) return "Az SMTP nincs beállítva (.env.local).";
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, EMAIL_USER, EMAIL_PASS, EMAIL_FROM_NAME } = process.env;
  const secure = SMTP_SECURE === "true";
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure,
    requireTLS: !secure,
    auth: { user: EMAIL_USER!, pass: EMAIL_PASS! },
  });
  try {
    await transport.sendMail({
      from: { name: EMAIL_FROM_NAME ?? "PannonGuard HR", address: EMAIL_USER! },
      to,
      replyTo,
      subject,
      text,
      html,
      attachments,
    });
    return undefined;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "ISMERETLEN";
    console.error("Levélküldési hiba:", code);
    return `A levél nem ment el (${code}).`;
  } finally {
    transport.close();
  }
}

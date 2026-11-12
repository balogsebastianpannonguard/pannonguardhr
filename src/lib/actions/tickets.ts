"use server";

import { headers } from "next/headers";
import { MAIL_LOGO_BASE64 } from "@/lib/mail-logo";
import { sendMail } from "@/lib/mail";
import { requireUser } from "@/lib/session";
import {
  TICKET_KINDS,
  TICKET_LOGO_CID,
  TICKET_PRIORITIES,
  TICKET_RECIPIENT,
  describeDevice,
  nextTicketNumber,
  takeTicketSlot,
  ticketHtml,
  ticketSubject,
  ticketText,
  tickets,
  type TicketKind,
  type TicketPriority,
} from "@/lib/tickets";

export type TicketInput = { kind: string; priority: string; title: string; description: string; page: string; diagnostics?: string[] };
export type TicketState = { ok?: boolean; number?: string; emailed?: boolean; error?: string };

/** A technikai napló sorai: legfeljebb 8 sor, soronként 300 karakter, vezérlőkarakterek nélkül. */
function cleanDiagnostics(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 300))
    .filter(Boolean)
    .slice(-8);
}

/** Hibajegyet vagy kérést vesz fel, tárolja, és HTML-levélben értesíti a fejlesztőt. */
export async function submitTicket(input: TicketInput): Promise<TicketState> {
  const user = await requireUser();

  const kind = (String(input.kind) in TICKET_KINDS ? input.kind : "hiba") as TicketKind;
  const priority = (String(input.priority) in TICKET_PRIORITIES ? input.priority : "normal") as TicketPriority;
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const description = String(input.description ?? "").replace(/\r\n/g, "\n").trim().slice(0, 4000);
  // Csak belső útvonal fogadható el, bármi más „/”.
  const page = /^\/[\w\-./\[\]]{0,150}$/.test(String(input.page ?? "")) ? String(input.page) : "/";
  const diagnostics = cleanDiagnostics(input.diagnostics);

  if (title.length < 4) return { error: "Adj a bejelentésnek rövid címet (legalább 4 karakter)." };
  if (description.length < 10) return { error: "Írd le részletesebben (legalább 10 karakter), hogy mit tapasztalsz vagy mit kérsz." };
  if (!(await takeTicketSlot(user.id))) return { error: "Az elmúlt órában már sok bejelentést küldtél. Próbáld újra később." };

  const now = new Date();
  const number = await nextTicketNumber(kind, Number(now.toISOString().slice(0, 4)));
  const device = describeDevice((await headers()).get("user-agent") ?? "").slice(0, 80);

  const ticket = {
    number,
    kind,
    priority,
    title,
    description,
    page,
    device,
    reporterName: user.name,
    reporterEmail: user.email,
    createdAt: now,
    ...(diagnostics.length && { diagnostics }),
  };

  const collection = await tickets();
  await collection.insertOne({ ...ticket, reporterId: user.id, emailed: false } as never);

  const failure = await sendMail({
    to: [TICKET_RECIPIENT],
    replyTo: user.email,
    subject: ticketSubject(ticket),
    text: ticketText(ticket),
    html: ticketHtml(ticket, `cid:${TICKET_LOGO_CID}`),
    attachments: [{ filename: "pannonguard.png", content: Buffer.from(MAIL_LOGO_BASE64, "base64"), contentType: "image/png", cid: TICKET_LOGO_CID }],
  });
  const emailed = !failure;
  if (emailed) await collection.updateOne({ number }, { $set: { emailed: true } });

  return { ok: true, number, emailed };
}

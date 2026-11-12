import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const TICKET_KINDS = {
  hiba: { label: "Hiba", emoji: "🐞", accent: "#d64550", soft: "#fdecee", title: "Hibajegy" },
  keres: { label: "Kérés", emoji: "💡", accent: "#2c4ea3", soft: "#e8eefc", title: "Fejlesztési kérés" },
} as const;
export type TicketKind = keyof typeof TICKET_KINDS;

export const TICKET_PRIORITIES = {
  alacsony: { label: "Alacsony", accent: "#2f9e6b", soft: "#e6f6ee", dots: 1 },
  normal: { label: "Normál", accent: "#2c4ea3", soft: "#e8eefc", dots: 2 },
  surgos: { label: "Sürgős", accent: "#d64550", soft: "#fdecee", dots: 3 },
} as const;
export type TicketPriority = keyof typeof TICKET_PRIORITIES;

export type TicketDocument = {
  _id: ObjectId;
  number: string;
  kind: TicketKind;
  priority: TicketPriority;
  title: string;
  description: string;
  page: string;
  device: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  createdAt: Date;
  emailed: boolean;
  /** Automatikusan mellékelt technikai napló (böngészőhibák, hibaoldal azonosítója); személyes adatot nem tartalmaz. */
  diagnostics?: string[];
};

export const tickets = async () => (await getDb()).collection<TicketDocument>("tickets");

/** A bejelentéseket fogadó cím; környezeti változóval felülírható, de a felhasználó nem adhatja meg. */
export const TICKET_RECIPIENT = process.env.TICKET_TO ?? "balogh.sebastian@pannonguard.hu";

// A „HR-” előtag megkülönbözteti a többi alrendszer jegyeitől ugyanabban a postafiókban.
const PREFIX: Record<TicketKind, string> = { hiba: "HR-HB", keres: "HR-KE" };

export async function nextTicketNumber(kind: TicketKind, year: number) {
  const counter = await (await getDb())
    .collection<{ _id: string; seq: number }>("counters")
    .findOneAndUpdate({ _id: `ticket-${kind}-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return `${PREFIX[kind]}-${year}-${String(counter!.seq).padStart(4, "0")}`;
}

const HOURLY_LIMIT = 6;

/** Óránként legfeljebb 6 bejelentés felhasználónként (levélbombázás ellen). */
export async function takeTicketSlot(userId: string, now = new Date()) {
  const collection = (await getDb()).collection<{ _id: string; count: number; expiresAt: Date }>("assistant_usage");
  const result = await collection.findOneAndUpdate(
    { _id: `ticket:${userId}:${now.toISOString().slice(0, 13)}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + 2 * 3_600_000) } },
    { upsert: true, returnDocument: "after" },
  );
  return (result?.count ?? 0) <= HOURLY_LIMIT;
}

/** Az User-Agentből rövid, olvasható eszközleírás (pl. „Chrome · macOS”). */
export function describeDevice(userAgent: string) {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Ismeretlen böngésző";
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "ismeretlen eszköz";
  return `${browser} · ${os}`;
}

/* ---------- E-mail ---------- */

const BRAND = {
  night: "#050b1f",
  navy: "#0a1533",
  royal: "#2c4ea3",
  gold: "#f2c200",
  goldBright: "#ffd84d",
  bronze: "#bf9f63",
  ink: "#1b2340",
  muted: "#5d6683",
  canvas: "#eef1f8",
  line: "#e3e7f1",
};
const SANS = "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',Times,serif";
export const TICKET_LOGO_CID = "pannonguard-logo";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const stamp = new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", dateStyle: "full", timeStyle: "short" });

export type TicketMail = Pick<
  TicketDocument,
  "number" | "kind" | "priority" | "title" | "description" | "page" | "device" | "reporterName" | "reporterEmail" | "createdAt" | "diagnostics"
>;

/** A levél tárgya: egy sor, a felhasználó szövegéből kivéve a sortörések (fejlécinjektálás ellen). */
export function ticketSubject(ticket: Pick<TicketMail, "number" | "kind" | "priority" | "title">) {
  const kind = TICKET_KINDS[ticket.kind];
  const urgent = ticket.priority === "surgos" ? "🚨 SÜRGŐS · " : "";
  const title = ticket.title.replace(/[\r\n]+/g, " ").slice(0, 120);
  return `${urgent}[${ticket.number}] ${kind.emoji} ${kind.label}: ${title}`;
}

export function ticketText(ticket: TicketMail) {
  const kind = TICKET_KINDS[ticket.kind];
  return `${kind.title.toUpperCase()} · ${ticket.number}
${"=".repeat(46)}

Cím:        ${ticket.title}
Típus:      ${kind.label}
Prioritás:  ${TICKET_PRIORITIES[ticket.priority].label}
Bejelentő:  ${ticket.reporterName} <${ticket.reporterEmail}>
Oldal:      ${ticket.page}
Eszköz:     ${ticket.device}
Időpont:    ${stamp.format(ticket.createdAt)}

Leírás
------
${ticket.description}
${ticket.diagnostics?.length ? `
Technikai napló\n---------------\n${ticket.diagnostics.join("\n")}\n` : ""}
---
Válaszolj erre a levélre, a válasz közvetlenül a bejelentőhöz megy.
PannonGuard HR · Pajzsi`;
}

export function ticketHtml(ticket: TicketMail, logoSrc: string) {
  const kind = TICKET_KINDS[ticket.kind];
  const priority = TICKET_PRIORITIES[ticket.priority];
  const safeEmail = /^[^\s@<>"]+@[^\s@<>"]+$/.test(ticket.reporterEmail) ? ticket.reporterEmail : "";
  const replySubject = encodeURIComponent(`Re: [${ticket.number}] ${ticket.title.replace(/[\r\n]+/g, " ").slice(0, 100)}`);
  const dots = [1, 2, 3]
    .map(
      (n) =>
        `<span style="display:inline-block;width:9px;height:9px;border-radius:9px;margin-right:3px;background:${n <= priority.dots ? priority.accent : "#d6dbea"};"></span>`,
    )
    .join("");

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid ${BRAND.line};font:600 11px/1.2 ${SANS};letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.muted};width:118px;vertical-align:top;">${label}</td>
      <td style="padding:11px 0;border-bottom:1px solid ${BRAND.line};font:500 14px/1.5 ${SANS};color:${BRAND.ink};vertical-align:top;">${value}</td>
    </tr>`;

  const description = esc(ticket.description).replace(/\r?\n/g, "<br>");

  return `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(ticket.number)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(kind.label)} · ${esc(priority.label)} prioritás · ${esc(ticket.title)} – bejelentő: ${esc(ticket.reporterName)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.canvas}" style="background:${BRAND.canvas};">
<tr><td align="center" style="padding:32px 14px;">

<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;">

  <!-- Fejléc -->
  <tr><td bgcolor="${BRAND.navy}" style="background:${BRAND.navy};background-image:linear-gradient(135deg,${BRAND.night} 0%,${BRAND.navy} 45%,#16275c 100%);border-radius:24px 24px 0 0;padding:38px 36px 30px;text-align:center;">
    <img src="${logoSrc}" width="72" alt="PannonGuard" style="display:block;margin:0 auto 18px;width:72px;height:auto;border:0;">
    <div style="font:600 11px/1 ${SANS};letter-spacing:4px;text-transform:uppercase;color:${BRAND.gold};">PannonGuard · HR</div>
    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
    <div style="display:inline-block;background:${kind.accent};border-radius:999px;padding:7px 18px;font:700 12px/1 ${SANS};letter-spacing:2px;text-transform:uppercase;color:#ffffff;">${kind.emoji}&nbsp; ${esc(kind.title)}</div>
    <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
    <div style="font:400 28px/1.25 ${SERIF};color:#ffffff;">${esc(ticket.title)}</div>
  </td></tr>

  <!-- Arany csík -->
  <tr><td height="5" bgcolor="${BRAND.gold}" style="height:5px;line-height:5px;font-size:0;background:${BRAND.gold};background-image:linear-gradient(90deg,${BRAND.bronze},${BRAND.goldBright} 50%,${BRAND.bronze});">&nbsp;</td></tr>

  <!-- Törzs -->
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:34px 36px 8px;">

    <!-- Azonosító + prioritás -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;">
        <div style="font:600 11px/1 ${SANS};letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};">Jegy azonosító</div>
        <div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
        <div style="display:inline-block;background:${BRAND.navy};border:2px solid ${BRAND.gold};border-radius:12px;padding:9px 16px;font:700 20px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:1.5px;color:${BRAND.goldBright};">${esc(ticket.number)}</div>
      </td>
      <td align="right" style="vertical-align:middle;">
        <div style="font:600 11px/1 ${SANS};letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};">Prioritás</div>
        <div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
        <div style="display:inline-block;background:${priority.soft};border:1px solid ${priority.accent};border-radius:999px;padding:8px 14px;font:700 13px/1 ${SANS};color:${priority.accent};">${dots}&nbsp; ${esc(priority.label)}</div>
      </td>
    </tr></table>

    <div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>

    <!-- Leírás -->
    <div style="font:600 11px/1 ${SANS};letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:10px;">A bejelentés szövege</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="5" bgcolor="${kind.accent}" style="width:5px;background:${kind.accent};border-radius:5px;">&nbsp;</td>
      <td bgcolor="${kind.soft}" style="background:${kind.soft};border-radius:0 14px 14px 0;padding:20px 22px;font:400 15px/1.7 ${SANS};color:${BRAND.ink};">${description}</td>
    </tr></table>

    <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>

    <!-- Részletek -->
    <div style="font:600 11px/1 ${SANS};letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:4px;">Részletek</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Bejelentő", `<strong>${esc(ticket.reporterName)}</strong>${safeEmail ? `<br><a href="mailto:${esc(safeEmail)}" style="color:${BRAND.royal};text-decoration:none;">${esc(safeEmail)}</a>` : ""}`)}
      ${row("Oldal", `<span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:13px;background:#f3f5fb;border-radius:6px;padding:3px 8px;">${esc(ticket.page)}</span>`)}
      ${row("Eszköz", esc(ticket.device))}
      ${row("Időpont", esc(stamp.format(ticket.createdAt)))}
    </table>
    ${
      ticket.diagnostics?.length
        ? `<div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>
    <div style="font:600 11px/1 ${SANS};letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:10px;">Technikai napló (automatikus)</div>
    <div style="background:#0a1533;border-radius:12px;padding:14px 16px;font:400 12px/1.6 'SFMono-Regular',Menlo,Consolas,monospace;color:#d6def5;word-break:break-word;">${ticket.diagnostics.map(esc).join("<br>")}</div>`
        : ""
    }

    <div style="height:32px;line-height:32px;font-size:0;">&nbsp;</div>

    <!-- Gomb -->
    ${
      safeEmail
        ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td align="center" bgcolor="${BRAND.gold}" style="border-radius:14px;background:${BRAND.gold};background-image:linear-gradient(135deg,${BRAND.goldBright},${BRAND.gold});box-shadow:0 10px 26px -8px rgba(242,194,0,.7);">
        <a href="mailto:${esc(safeEmail)}?subject=${replySubject}" style="display:inline-block;padding:16px 34px;font:700 15px/1 ${SANS};letter-spacing:.4px;color:${BRAND.night};text-decoration:none;">✉&nbsp; Válasz a bejelentőnek</a>
      </td></tr></table>`
        : ""
    }
    <div style="height:30px;line-height:30px;font-size:0;">&nbsp;</div>
  </td></tr>

  <!-- Pajzs üzenet -->
  <tr><td bgcolor="#f6f8fd" style="background:#f6f8fd;padding:20px 36px;border-top:1px solid ${BRAND.line};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="44" style="vertical-align:top;font-size:30px;line-height:1;">🛡️</td>
      <td style="font:400 13px/1.6 ${SANS};color:${BRAND.muted};vertical-align:top;"><strong style="color:${BRAND.ink};">Pajzsi</strong>, a HR védőangyala vette fel ezt a jegyet. A levélre válaszolva a válasz közvetlenül a bejelentőhöz megy.</td>
    </tr></table>
  </td></tr>

  <!-- Lábléc -->
  <tr><td bgcolor="${BRAND.navy}" style="background:${BRAND.navy};border-radius:0 0 24px 24px;padding:26px 36px;text-align:center;">
    <div style="font:400 16px/1 ${SERIF};color:${BRAND.goldBright};letter-spacing:.5px;">PannonGuard Biztonsági Szolgáltató Zrt.</div>
    <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
    <div style="font:400 12px/1.6 ${SANS};color:#9aa6cf;">4026 Debrecen, Hatvan utca 39. II/3. · pannon@pannonguard.hu</div>
    <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
    <div style="font:400 11px/1.5 ${SANS};color:#6c79a8;">Automatikus értesítés a PannonGuard Komplex rendszerből.</div>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

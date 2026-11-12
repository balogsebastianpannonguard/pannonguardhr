import "server-only";
import { headers } from "next/headers";
import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type AuditEvent =
  | "register"
  | "totp.enabled"
  | "login.success"
  | "login.failure"
  | "login.locked"
  | "totp.failure"
  | "logout"
  | "logout.all"
  | "password.reset";

type AuditEntry = {
  event: AuditEvent;
  userId?: ObjectId;
  email: string;
  ip: string;
  userAgent: string;
  at: Date;
};

const auditLog = async () => (await getDb()).collection<AuditEntry>("audit_log");

export async function recordAudit(event: AuditEvent, email: string, userId?: ObjectId) {
  try {
    const requestHeaders = await headers();
    await (await auditLog()).insertOne({
      event,
      userId,
      email: email.slice(0, 120),
      ip:
        requestHeaders.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 64) ??
        "ismeretlen",
      userAgent: (requestHeaders.get("user-agent") ?? "").slice(0, 200),
      at: new Date(),
    });
  } catch (error) {
    // A naplózás hibája nem akaszthatja meg a belépést.
    console.error("Naplózási hiba:", (error as Error).name);
  }
}

export async function listUserAudit(userId: ObjectId, limit = 20) {
  return (await auditLog())
    .find({ userId }, { projection: { _id: 0, event: 1, ip: 1, userAgent: 1, at: 1 } })
    .sort({ at: -1 })
    .limit(limit)
    .toArray();
}

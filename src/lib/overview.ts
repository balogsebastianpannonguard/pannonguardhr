import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { addDays, dayKey } from "@/lib/dates";
import type { AuditEvent } from "@/lib/audit";

type Entry = { event: AuditEvent; at: Date };

export type LoginDay = { day: string; success: number; failure: number };

/** A saját fiók utolsó 14 napjának belépései a naplóból. */
export async function loadActivity(userId: ObjectId, now: Date) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const entries = await (await getDb())
    .collection<Entry>("audit_log")
    .find({ userId, at: { $gte: since } }, { projection: { _id: 0, event: 1, at: 1 } })
    .sort({ at: -1 })
    .toArray();

  const today = dayKey(now);
  const days: LoginDay[] = Array.from({ length: 14 }, (_, index) => ({
    day: addDays(today, index - 13),
    success: 0,
    failure: 0,
  }));
  const byDay = new Map(days.map((entry) => [entry.day, entry]));

  let failures = 0;
  const logins: Date[] = [];
  for (const { event, at } of entries) {
    const bucket = byDay.get(dayKey(at));
    if (event === "login.success") {
      logins.push(at);
      if (bucket) bucket.success += 1;
    }
    if (event === "login.failure" || event === "totp.failure" || event === "login.locked") {
      failures += 1;
      if (bucket) bucket.failure += 1;
    }
  }

  return {
    days,
    failures,
    logins30: logins.length,
    // A legfrissebb belépés a mostani, ezért az előző a második.
    previousLogin: logins[1] as Date | undefined,
  };
}

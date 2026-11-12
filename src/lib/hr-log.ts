import "server-only";
import { getDb } from "@/lib/mongodb";

/**
 * HR-változásnapló: ki, mikor, mit módosított (GDPR elszámoltathatóság). A bejegyzés soha nem tartalmaz
 * személyes adatot (bér, azonosítók) – csak a művelet és a rekord rövid megnevezése kerül bele.
 */
export type HrLogEntry = {
  at: Date;
  by: string;
  byName: string;
  /** pl. "employee.create", "candidate.update", "training.delete" */
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
};

export const hrLog = async () => (await getDb()).collection<HrLogEntry>("hr_log");

export async function logChange(user: { id: string; name: string }, action: string, entity: string, summary: string, entityId?: string) {
  try {
    await (await hrLog()).insertOne({ at: new Date(), by: user.id, byName: user.name, action, entity, entityId, summary: summary.slice(0, 200) });
  } catch (error) {
    console.error("HR-napló hiba:", (error as Error).name);
  }
}

export async function recentChanges(filter: Partial<Pick<HrLogEntry, "entity" | "entityId">> = {}, limit = 20) {
  return (await hrLog()).find(filter, { projection: { _id: 0 } }).sort({ at: -1 }).limit(limit).toArray();
}

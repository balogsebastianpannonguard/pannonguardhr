import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { clip, workingDays, type AbsenceRow, type AbsenceType } from "@/lib/absences-meta";
import { employeeOptions } from "@/lib/employees";
import { getDb } from "@/lib/mongodb";

export type AbsenceDoc = {
  _id: ObjectId;
  employeeId: string;
  /** A név pillanatképe (a felületen a dolgozói adatbázis aktuális neve az elsődleges). */
  employeeName: string;
  type: AbsenceType;
  /** ÉÉÉÉ-HH-NN, zárt intervallum. */
  from: string;
  to: string;
  /** Fél nap (csak egynapos tételnél). */
  halfDay: boolean;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

/** Éves szabadságkeret dolgozónként (`_id` = „employeeId:év”). */
export type LeaveAllowanceDoc = {
  _id: string;
  employeeId: string;
  year: number;
  /** Az évre járó szabadság munkanapban (alap + pótszabadságok). */
  days: number;
  /** Az előző évből áthozott napok. */
  carryOver?: number;
  note?: string;
  updatedAt: Date;
  updatedBy: string;
};

export const absences = async () => (await getDb()).collection<AbsenceDoc>("absences");
export const leaveAllowances = async () => (await getDb()).collection<LeaveAllowanceDoc>("leave_allowances");

let indexed = false;
async function ensureIndexes() {
  if (indexed) return;
  const collection = await absences();
  await Promise.all([collection.createIndex({ from: 1, to: 1 }), collection.createIndex({ employeeId: 1, from: 1 })]);
  indexed = true;
}

export const parseAbsenceId = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);

function toRow(doc: AbsenceDoc, names?: Map<string, string>): AbsenceRow {
  return {
    id: String(doc._id),
    employeeId: doc.employeeId,
    employeeName: names?.get(doc.employeeId) ?? doc.employeeName,
    type: doc.type,
    from: doc.from,
    to: doc.to,
    halfDay: Boolean(doc.halfDay),
    note: doc.note,
    days: workingDays(doc.from, doc.to, doc.halfDay),
  };
}

async function names() {
  return new Map((await employeeOptions(true)).map((option) => [option.id, option.name]));
}

/** Az időszakot érintő távollétek (bármilyen átfedéssel), opcionálisan egy dolgozóra szűrve. */
export async function absencesBetween(from: string, to: string, employeeId?: string) {
  await ensureIndexes();
  const filter: Filter<AbsenceDoc> = { from: { $lte: to }, to: { $gte: from } };
  if (employeeId) filter.employeeId = employeeId;
  const [docs, map] = await Promise.all([(await absences()).find(filter).sort({ from: 1 }).limit(5000).toArray(), names()]);
  return docs.map((doc) => toRow(doc, map)).sort((a, b) => a.from.localeCompare(b.from) || a.employeeName.localeCompare(b.employeeName, "hu"));
}

export async function getAbsence(id: string) {
  const _id = parseAbsenceId(id);
  if (!_id) return null;
  const [doc, map] = await Promise.all([(await absences()).findOne({ _id }), names()]);
  return doc ? toRow(doc, map) : null;
}

/** Ugyanannak a dolgozónak az átfedő távollétei (szerkesztésnél a saját tétel nélkül). */
export async function overlappingAbsences(employeeId: string, from: string, to: string, excludeId?: string) {
  const filter: Filter<AbsenceDoc> = { employeeId, from: { $lte: to }, to: { $gte: from } };
  const exclude = excludeId ? parseAbsenceId(excludeId) : null;
  if (exclude) filter._id = { $ne: exclude };
  const docs = await (await absences()).find(filter).sort({ from: 1 }).limit(20).toArray();
  return docs.map((doc) => toRow(doc));
}

/** A tétel munkanapjai egy időszakon belül (pl. hónap, év). */
export function daysWithin(row: Pick<AbsenceRow, "from" | "to" | "halfDay">, start: string, end: string) {
  const part = clip(row.from, row.to, start, end);
  return part ? workingDays(part.from, part.to, row.halfDay && row.from === row.to) : 0;
}

/* ---------- Éves áttekintés ---------- */

export type YearSummary = {
  employeeId: string;
  name: string;
  position: string;
  department?: string;
  status: string;
  allowance?: number;
  carryOver?: number;
  note?: string;
  used: number;
  remaining?: number;
  byType: Partial<Record<AbsenceType, number>>;
};

/** Dolgozónként: éves keret, felhasznált szabadság, maradék és a többi távollét típusonként. */
export async function yearOverview(year: number, includeExited = false): Promise<YearSummary[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const [options, rows, allowances] = await Promise.all([
    employeeOptions(includeExited),
    absencesBetween(start, end),
    (await leaveAllowances()).find({ year }).toArray(),
  ]);
  const byEmployee = new Map<string, AbsenceRow[]>();
  for (const row of rows) byEmployee.set(row.employeeId, [...(byEmployee.get(row.employeeId) ?? []), row]);
  const allowanceOf = new Map(allowances.map((doc) => [doc.employeeId, doc]));
  return options.map((option) => {
    const byType: Partial<Record<AbsenceType, number>> = {};
    for (const row of byEmployee.get(option.id) ?? []) byType[row.type] = (byType[row.type] ?? 0) + daysWithin(row, start, end);
    const allowance = allowanceOf.get(option.id);
    const used = byType.szabadsag ?? 0;
    const total = allowance ? allowance.days + (allowance.carryOver ?? 0) : undefined;
    return {
      employeeId: option.id,
      name: option.name,
      position: option.position,
      department: option.department,
      status: option.status,
      allowance: allowance?.days,
      carryOver: allowance?.carryOver,
      note: allowance?.note,
      used,
      remaining: total === undefined ? undefined : total - used,
      byType,
    };
  });
}

export async function getAllowance(employeeId: string, year: number) {
  return (await leaveAllowances()).findOne({ _id: `${employeeId}:${year}` });
}

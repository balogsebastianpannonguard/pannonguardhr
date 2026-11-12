import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { openData, sealData } from "@/lib/data-box";
import { addDays, dayKey } from "@/lib/dates";
import { expiriesOf, type EmployeeSecret, type EmployeeStatus, type EmploymentType, type ExitReason, type Qualification } from "@/lib/employee-meta";
import { getDb } from "@/lib/mongodb";

/* A szótárak, a lejárat-számítás és a dátumsegédek kliensoldalon is kellenek, ezért külön fájlban élnek. */
export * from "@/lib/employee-meta";

/* ---------- Adatmodell ---------- */

export type EmployeeDocument = {
  _id: ObjectId;
  name: string;
  email?: string;
  phone?: string;
  /** Munkakör, pl. „Vagyonőr”, „Objektumvezető”. */
  position: string;
  /** Szervezeti egység / objektum / telephely. */
  department?: string;
  manager?: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  /** Munkaviszony kezdete (ÉÉÉÉ-HH-NN). */
  startDate?: string;
  /** Határozott idő vége. */
  contractEnd?: string;
  /** Próbaidő vége. */
  probationEnd?: string;
  weeklyHours?: number;
  /** Kilépés napja és oka. */
  exitDate?: string;
  exitReason?: ExitReason;
  /** Legmagasabb iskolai végzettség (rövid szöveg). */
  education?: string;
  /** Foglalkozás-egészségügyi alkalmassági vizsgálat érvényessége (ÉÉÉÉ-HH-NN). */
  medicalExpiry?: string;
  /** Vagyonőri igazolvány száma és lejárata. */
  guardLicenseNumber?: string;
  guardLicenseExpiry?: string;
  qualifications: Qualification[];
  notes?: string;
  /** Titkosított EmployeeSecret (data-box). */
  secret?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

/** A felületnek átadható alak: string azonosító, a bizalmas adatok csak kifejezett kérésre. */
export type Employee = Omit<EmployeeDocument, "_id" | "secret"> & { id: string };

export const employees = async () => (await getDb()).collection<EmployeeDocument>("employees");

let indexed = false;
async function ensureIndexes() {
  if (indexed) return;
  const collection = await employees();
  await Promise.all([
    collection.createIndex({ status: 1, name: 1 }),
    collection.createIndex({ position: 1 }),
    collection.createIndex({ department: 1 }),
    collection.createIndex({ email: 1 }, { sparse: true }),
  ]);
  indexed = true;
}

export function toEmployee({ _id, secret: _secret, ...rest }: EmployeeDocument): Employee {
  void _secret;
  return { ...rest, id: String(_id), qualifications: rest.qualifications ?? [] };
}

export function readSecret(doc: Pick<EmployeeDocument, "secret">): EmployeeSecret {
  return openData<EmployeeSecret>(doc.secret, {});
}

export function sealSecret(secret: EmployeeSecret) {
  const clean = Object.fromEntries(Object.entries(secret).filter(([, value]) => value !== undefined && value !== ""));
  return Object.keys(clean).length ? sealData(clean) : undefined;
}

export const parseId = (id: string) => (ObjectId.isValid(id) && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);

export type EmployeeQuery = { q?: string; status?: EmployeeStatus | "all"; position?: string; department?: string };

/** Keresés névre, e-mailre, munkakörre, egységre; alapból csak a nem kilépett dolgozók. */
export async function listEmployees({ q, status, position, department }: EmployeeQuery = {}) {
  await ensureIndexes();
  const filter: Filter<EmployeeDocument> = {};
  if (!status) filter.status = { $ne: "kilepett" };
  else if (status !== "all") filter.status = status;
  if (position) filter.position = position;
  if (department) filter.department = department;
  if (q?.trim()) {
    const pattern = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { position: pattern }, { department: pattern }, { "qualifications.name": pattern }];
  }
  const docs = await (await employees()).find(filter, { projection: { secret: 0 } }).sort({ name: 1 }).limit(2000).toArray();
  return docs.map(toEmployee);
}

export async function getEmployee(id: string) {
  const _id = parseId(id);
  if (!_id) return null;
  return (await employees()).findOne({ _id });
}

/** Egyszerű választólistához: azonosító, név, munkakör (pl. képzés résztvevői, dokumentumgenerálás). */
export async function employeeOptions(includeExited = false) {
  const docs = await (await employees())
    .find(includeExited ? {} : { status: { $ne: "kilepett" } }, { projection: { name: 1, position: 1, department: 1, status: 1 } })
    .sort({ name: 1 })
    .toArray();
  return docs.map((doc) => ({ id: String(doc._id), name: doc.name, position: doc.position, department: doc.department, status: doc.status }));
}

/** A meglévő munkakörök és egységek (szűrőkhöz, javaslatokhoz). */
export async function employeeFacets() {
  const collection = await employees();
  const [positions, departments] = await Promise.all([collection.distinct("position"), collection.distinct("department")]);
  return {
    positions: positions.filter(Boolean).sort((a, b) => a.localeCompare(b, "hu")),
    departments: (departments.filter(Boolean) as string[]).sort((a, b) => a.localeCompare(b, "hu")),
  };
}

/* ---------- Lejárat-figyelés ---------- */

/** Az összes aktív dolgozó `withinDays` napon belül lejáró (vagy már lejárt) tételei, sürgősség szerint. */
export async function upcomingExpiries(withinDays = 60) {
  const today = dayKey(new Date());
  const limit = addDays(today, withinDays);
  const docs = await (await employees())
    .find(
      { status: { $ne: "kilepett" } },
      { projection: { name: 1, medicalExpiry: 1, guardLicenseExpiry: 1, contractEnd: 1, probationEnd: 1, qualifications: 1, status: 1 } },
    )
    .toArray();
  return docs
    .flatMap((doc) => expiriesOf({ ...doc, id: String(doc._id), qualifications: doc.qualifications ?? [] }, today))
    .filter((item) => item.date <= limit)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}


/* ---------- Összesítők ---------- */

/** Állapotonkénti létszám (a listaoldal számlálóihoz). */
export async function employeeStatusCounts() {
  await ensureIndexes();
  const rows = await (await employees()).aggregate<{ _id: EmployeeStatus; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray();
  const counts: Record<EmployeeStatus, number> = { aktiv: 0, belepes: 0, szunetel: 0, kilepett: 0 };
  for (const row of rows) if (row._id in counts) counts[row._id] = row.count;
  return counts;
}

/** Az áttekintő létszámadatai: állapotok, valamint az adott hónap belépői és kilépői. */
export async function headcountSummary(now = new Date()) {
  const month = dayKey(now).slice(0, 7);
  const range = { $gte: `${month}-01`, $lte: `${month}-31` };
  const collection = await employees();
  const [counts, joiners, leavers] = await Promise.all([
    employeeStatusCounts(),
    collection.countDocuments({ startDate: range, status: { $ne: "kilepett" } }),
    collection.countDocuments({ exitDate: range }),
  ]);
  return { counts, joiners, leavers };
}

/** Egy dolgozó a felület számára (a bizalmas adatok nélkül). */
export async function getEmployeeView(id: string) {
  const doc = await getEmployee(id);
  return doc ? { employee: toEmployee(doc), hasSecret: Boolean(doc.secret) } : null;
}

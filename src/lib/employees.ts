import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { openData, sealData } from "@/lib/data-box";
import { addDays, dayKey } from "@/lib/dates";
import { getDb } from "@/lib/mongodb";

/* ---------- Szótárak (a felületen és az AI-promptokban is ezek a megnevezések) ---------- */

export const EMPLOYEE_STATUS = {
  aktiv: "Aktív",
  belepes: "Belépés alatt",
  szunetel: "Szünetel (GYED, tartós távollét)",
  kilepett: "Kilépett",
} as const;
export type EmployeeStatus = keyof typeof EMPLOYEE_STATUS;

export const EMPLOYMENT_TYPES = {
  hatarozatlan: "Határozatlan idejű",
  hatarozott: "Határozott idejű",
  reszmunkaido: "Részmunkaidős",
  megbizasi: "Megbízási jogviszony",
  diak: "Diákmunka",
} as const;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;

export const QUALIFICATION_KINDS = {
  vegzettseg: "Végzettség",
  kepesites: "Képesítés",
  igazolvany: "Igazolvány / engedély",
  jogositvany: "Jogosítvány",
  egyeb: "Egyéb jogosultság",
} as const;
export type QualificationKind = keyof typeof QUALIFICATION_KINDS;

export const EXIT_REASONS = {
  munkavallaloi_felmondas: "Munkavállalói felmondás",
  munkaltatoi_felmondas: "Munkáltatói felmondás",
  kozos_megegyezes: "Közös megegyezés",
  hatarozott_lejart: "Határozott idő lejárta",
  probaido: "Próbaidő alatti megszüntetés",
  azonnali: "Azonnali hatályú megszüntetés",
  nyugdij: "Nyugdíjba vonulás",
  egyeb: "Egyéb",
} as const;
export type ExitReason = keyof typeof EXIT_REASONS;

/* ---------- Adatmodell ---------- */

export type Qualification = {
  id: string;
  kind: QualificationKind;
  name: string;
  /** Okmány- vagy bizonyítványszám. */
  number?: string;
  /** ÉÉÉÉ-HH-NN */
  issuedAt?: string;
  /** ÉÉÉÉ-HH-NN – ha van, a lejárat figyelése ebből történik. */
  expiresAt?: string;
  note?: string;
};

/** Bizalmas adatok: csak titkosítva kerülnek az adatbázisba (`secret` mező). */
export type EmployeeSecret = {
  birthName?: string;
  birthPlace?: string;
  birthDate?: string;
  motherName?: string;
  address?: string;
  taxId?: string;
  tajNumber?: string;
  bankAccount?: string;
  /** Bruttó alapbér forintban. */
  salary?: number;
  salaryType?: "havi" | "oraber";
};

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
    filter.$or = [{ name: pattern }, { email: pattern }, { position: pattern }, { department: pattern }, { "qualifications.name": pattern }];
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

export type Expiry = {
  employeeId: string;
  employeeName: string;
  kind: "orvosi" | "vagyonor" | "kepesites" | "szerzodes" | "probaido";
  label: string;
  date: string;
  daysLeft: number;
};

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Egy dolgozó figyelendő dátumai (a lejártak is, negatív napszámmal). */
export function expiriesOf(employee: Pick<Employee, "id" | "name" | "medicalExpiry" | "guardLicenseExpiry" | "contractEnd" | "probationEnd" | "qualifications" | "status">, today = dayKey(new Date())): Expiry[] {
  if (employee.status === "kilepett") return [];
  const base = { employeeId: employee.id, employeeName: employee.name };
  const items: Expiry[] = [];
  const push = (kind: Expiry["kind"], label: string, date?: string) => {
    if (date) items.push({ ...base, kind, label, date, daysLeft: daysBetween(today, date) });
  };
  push("orvosi", "Foglalkozás-egészségügyi alkalmasság", employee.medicalExpiry);
  push("vagyonor", "Vagyonőri igazolvány", employee.guardLicenseExpiry);
  push("szerzodes", "Határozott idejű szerződés vége", employee.contractEnd);
  push("probaido", "Próbaidő vége", employee.probationEnd);
  for (const qualification of employee.qualifications ?? []) push("kepesites", qualification.name, qualification.expiresAt);
  return items;
}

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

export const expiryTone = (daysLeft: number) => (daysLeft < 0 ? "error" : daysLeft <= 30 ? "warning" : "muted") as "error" | "warning" | "muted";
export const expiryText = (daysLeft: number) => (daysLeft < 0 ? `${-daysLeft} napja lejárt` : daysLeft === 0 ? "ma jár le" : `${daysLeft} nap múlva`);

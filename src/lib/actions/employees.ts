"use server";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decodeCsv, mapImportRows, parseCsv, type ImportCandidate, type ImportRow } from "@/lib/employees-csv";
import {
  EMPLOYEE_STATUS,
  EXIT_REASONS,
  employees,
  isEmploymentType,
  isExitReason,
  isQualificationKind,
  isStatus,
  normalizeKey,
  parseId,
  readSecret,
  sealSecret,
  type EmployeeDocument,
  type EmployeeSecret,
  type Qualification,
} from "@/lib/employees";
import { DAY, EMAIL, longText, num, optional, text, type FormState } from "@/lib/form";
import { eraseEmployeeRecords } from "@/lib/erasure";
import { logChange } from "@/lib/hr-log";
import { requireUser } from "@/lib/session";

/** A munkavállalói adatok több oldalon is megjelennek (lista, lejáratok, áttekintés). */
function touch(id?: string) {
  revalidatePath("/munkavallalok");
  if (id) revalidatePath(`/munkavallalok/${id}`);
  revalidatePath("/lejaratok");
  revalidatePath("/");
}

const day = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/* ---------- Alap- és munkaviszony-adatok ---------- */

type Fields = Pick<
  EmployeeDocument,
  | "name"
  | "email"
  | "phone"
  | "position"
  | "department"
  | "manager"
  | "status"
  | "employmentType"
  | "startDate"
  | "probationEnd"
  | "contractEnd"
  | "weeklyHours"
  | "education"
  | "medicalExpiry"
  | "guardLicenseNumber"
  | "guardLicenseExpiry"
  | "notes"
>;

const OPTIONAL_FIELDS = [
  "email",
  "phone",
  "department",
  "manager",
  "startDate",
  "probationEnd",
  "contractEnd",
  "weeklyHours",
  "education",
  "medicalExpiry",
  "guardLicenseNumber",
  "guardLicenseExpiry",
  "notes",
] as const;

const DATE_LABELS = {
  startDate: "belépés napja",
  probationEnd: "próbaidő vége",
  contractEnd: "határozott idő vége",
  medicalExpiry: "orvosi alkalmasság lejárata",
  guardLicenseExpiry: "vagyonőri igazolvány lejárata",
} as const;

function readFields(formData: FormData): { fields?: Fields; error?: string } {
  const name = text(formData, "name", 120);
  const email = text(formData, "email", 160).toLowerCase();
  const position = text(formData, "position", 80);
  const status = String(formData.get("status") ?? "");
  const employmentType = String(formData.get("employmentType") ?? "");
  const weeklyHours = num(formData, "weeklyHours");
  if (name.length < 2) return { error: "Add meg a munkavállaló nevét." };
  if (email && !EMAIL.test(email)) return { error: "Az e-mail-cím formátuma hibás." };
  if (position.length < 2) return { error: "Add meg a munkakört." };
  if (!isStatus(status)) return { error: "Válassz állapotot." };
  if (!isEmploymentType(employmentType)) return { error: "Válassz jogviszonyt." };
  if (weeklyHours !== undefined && (Number.isNaN(weeklyHours) || weeklyHours <= 0 || weeklyHours > 60)) return { error: "A heti óraszám 1 és 60 között legyen." };
  const dates = {} as Record<keyof typeof DATE_LABELS, string | undefined>;
  for (const [key, label] of Object.entries(DATE_LABELS) as [keyof typeof DATE_LABELS, string][]) {
    const value = day(formData, key);
    if (value && !DAY.test(value)) return { error: `A(z) ${label} dátuma hibás.` };
    dates[key] = optional(value);
  }
  if (dates.probationEnd && dates.startDate && dates.probationEnd < dates.startDate) return { error: "A próbaidő vége nem lehet a belépés előtt." };
  if (dates.contractEnd && dates.startDate && dates.contractEnd < dates.startDate) return { error: "A határozott idő vége nem lehet a belépés előtt." };
  return {
    fields: {
      name,
      email: optional(email),
      phone: optional(text(formData, "phone", 40)),
      position,
      department: optional(text(formData, "department", 120)),
      manager: optional(text(formData, "manager", 120)),
      status,
      employmentType,
      ...dates,
      weeklyHours,
      education: optional(text(formData, "education", 160)),
      guardLicenseNumber: optional(text(formData, "guardLicenseNumber", 40)),
      notes: optional(longText(formData, "notes", 4000)),
    },
  };
}

/* ---------- Bizalmas adatok ---------- */

function readSecretFields(formData: FormData): { secret?: EmployeeSecret; error?: string } {
  const digits = (name: string) => String(formData.get(name) ?? "").replace(/[\s-]/g, "");
  const taxId = digits("taxId");
  const tajNumber = digits("tajNumber");
  const bank = digits("bankAccount");
  const birthDate = day(formData, "birthDate");
  const salary = num(formData, "salary");
  const salaryType = String(formData.get("salaryType") ?? "");
  if (taxId && !/^8\d{9}$/.test(taxId)) return { error: "Az adóazonosító jel 10 számjegy, 8-cal kezdődik." };
  if (tajNumber && !/^\d{9}$/.test(tajNumber)) return { error: "A TAJ-szám 9 számjegyből áll." };
  if (bank && !/^(\d{16}|\d{24})$/.test(bank)) return { error: "A bankszámlaszám 16 vagy 24 számjegyből áll." };
  if (birthDate && !DAY.test(birthDate)) return { error: "A születési idő hibás." };
  if (salary !== undefined && (Number.isNaN(salary) || salary < 0 || salary > 100_000_000)) return { error: "A bér összege hibás." };
  if (salaryType && salaryType !== "havi" && salaryType !== "oraber") return { error: "Válassz bérformát." };
  return {
    secret: {
      birthName: optional(text(formData, "birthName", 120)),
      birthPlace: optional(text(formData, "birthPlace", 80)),
      birthDate: optional(birthDate),
      motherName: optional(text(formData, "motherName", 120)),
      address: optional(text(formData, "address", 240)),
      taxId: optional(taxId),
      tajNumber: optional(tajNumber && `${tajNumber.slice(0, 3)} ${tajNumber.slice(3, 6)} ${tajNumber.slice(6)}`),
      bankAccount: optional(bank.match(/\d{8}/g)?.join("-") ?? ""),
      salary: salary === undefined ? undefined : Math.round(salary),
      salaryType: salary === undefined ? undefined : salaryType === "oraber" ? "oraber" : "havi",
    },
  };
}

async function duplicateOf(fields: Pick<Fields, "email" | "name" | "startDate">, exceptId?: ObjectId) {
  if (!fields.email) return null;
  return (await employees()).findOne({ email: fields.email, ...(exceptId && { _id: { $ne: exceptId } }) }, { projection: { _id: 1 } });
}

export async function createEmployee(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { fields, error } = readFields(formData);
  if (!fields) return { error };
  const { secret, error: secretError } = readSecretFields(formData);
  if (!secret) return { error: secretError };
  if (await duplicateOf(fields)) return { error: "Ezzel az e-mail-címmel már van munkavállaló a nyilvántartásban." };

  const now = new Date();
  const _id = new ObjectId();
  const sealed = sealSecret(secret);
  const clean = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Fields;
  await (await employees()).insertOne({
    _id,
    ...clean,
    qualifications: [],
    ...(sealed && { secret: sealed }),
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
    updatedBy: user.id,
  });
  await logChange(user, "employee.create", "employee", `Új munkavállaló felvéve (${fields.position})`, String(_id));
  touch();
  redirect(`/munkavallalok/${_id}?uj=1`);
}

export async function updateEmployee(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const _id = parseId(String(formData.get("id") ?? ""));
  if (!_id) return { error: "Ismeretlen munkavállaló." };
  const { fields, error } = readFields(formData);
  if (!fields) return { error };
  const collection = await employees();
  const current = await collection.findOne({ _id }, { projection: { status: 1 } });
  if (!current) return { error: "A munkavállaló nem található." };
  if (await duplicateOf(fields, _id)) return { error: "Ezzel az e-mail-címmel már van másik munkavállaló." };

  const cleared: string[] = OPTIONAL_FIELDS.filter((key) => fields[key] === undefined);
  // Ha a kilépett dolgozót visszaállítják, a kilépés adatai törlődnek.
  if (current.status === "kilepett" && fields.status !== "kilepett") cleared.push("exitDate", "exitReason");
  const filled = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  await collection.updateOne(
    { _id },
    {
      $set: { ...filled, updatedAt: new Date(), updatedBy: user.id },
      ...(cleared.length && { $unset: Object.fromEntries(cleared.map((key) => [key, ""])) }),
    },
  );
  const statusNote = current.status !== fields.status ? `; állapot: ${EMPLOYEE_STATUS[current.status]} → ${EMPLOYEE_STATUS[fields.status]}` : "";
  await logChange(user, "employee.update", "employee", `Adatok módosítva${statusNote}`, String(_id));
  touch(String(_id));
  redirect(`/munkavallalok/${_id}?mentve=1`);
}

/** A bizalmas adatok megjelenítése: csak kifejezett kérésre, naplózva. */
export async function revealEmployeeSecret(id: string): Promise<{ secret?: EmployeeSecret; error?: string }> {
  const user = await requireUser();
  const _id = parseId(id);
  if (!_id) return { error: "Ismeretlen munkavállaló." };
  const doc = await (await employees()).findOne({ _id }, { projection: { secret: 1 } });
  if (!doc) return { error: "A munkavállaló nem található." };
  try {
    const secret = readSecret(doc);
    await logChange(user, "employee.secret.view", "employee", "Bér és személyes adatok megtekintve", id);
    return { secret };
  } catch {
    return { error: "A bizalmas adatok nem fejthetők vissza (titkosítási kulcs hiba). Szólj a rendszergazdának." };
  }
}

export async function saveEmployeeSecret(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const _id = parseId(id);
  if (!_id) return { error: "Ismeretlen munkavállaló." };
  const { secret, error } = readSecretFields(formData);
  if (!secret) return { error };
  const sealed = sealSecret(secret);
  const result = await (await employees()).updateOne(
    { _id },
    sealed
      ? { $set: { secret: sealed, updatedAt: new Date(), updatedBy: user.id } }
      : { $unset: { secret: "" }, $set: { updatedAt: new Date(), updatedBy: user.id } },
  );
  if (!result.matchedCount) return { error: "A munkavállaló nem található." };
  await logChange(user, "employee.secret.update", "employee", "Bér és személyes adatok módosítva", id);
  revalidatePath(`/munkavallalok/${id}`);
  return { ok: true, message: "A bizalmas adatokat titkosítva mentettem." };
}

/* ---------- Végzettségek, képesítések, jogosultságok ---------- */

export async function saveQualification(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("employeeId") ?? "");
  const _id = parseId(id);
  if (!_id) return { error: "Ismeretlen munkavállaló." };
  const qualificationId = String(formData.get("qualificationId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const name = text(formData, "name", 160);
  const issuedAt = day(formData, "issuedAt");
  const expiresAt = day(formData, "expiresAt");
  if (!isQualificationKind(kind)) return { error: "Válaszd ki a típust." };
  if (name.length < 2) return { error: "Add meg a megnevezést." };
  if ((issuedAt && !DAY.test(issuedAt)) || (expiresAt && !DAY.test(expiresAt))) return { error: "A dátum formátuma hibás." };
  if (issuedAt && expiresAt && expiresAt < issuedAt) return { error: "A lejárat nem lehet a kiállítás előtt." };
  const item: Qualification = {
    id: qualificationId || randomUUID().slice(0, 8),
    kind,
    name,
    ...(text(formData, "number", 60) && { number: text(formData, "number", 60) }),
    ...(issuedAt && { issuedAt }),
    ...(expiresAt && { expiresAt }),
    ...(text(formData, "note", 300) && { note: text(formData, "note", 300) }),
  };

  const collection = await employees();
  const stamp = { updatedAt: new Date(), updatedBy: user.id };
  const result = qualificationId
    ? await collection.updateOne({ _id, "qualifications.id": qualificationId }, { $set: { "qualifications.$": item, ...stamp } })
    : await collection.updateOne({ _id }, { $push: { qualifications: item }, $set: stamp });
  if (!result.matchedCount) return { error: "A tétel nem található." };
  await logChange(user, qualificationId ? "employee.qualification.update" : "employee.qualification.create", "employee", `${qualificationId ? "Módosítva" : "Felvéve"}: ${name}`, id);
  touch(id);
  return { ok: true, message: "Mentve." };
}

export async function removeQualification(employeeId: string, qualificationId: string): Promise<FormState> {
  const user = await requireUser();
  const _id = parseId(employeeId);
  if (!_id || !qualificationId) return { error: "Érvénytelen kérés." };
  const collection = await employees();
  const doc = await collection.findOne({ _id }, { projection: { qualifications: 1 } });
  const item = doc?.qualifications?.find((entry) => entry.id === qualificationId);
  if (!item) return { error: "A tétel nem található." };
  await collection.updateOne({ _id }, { $pull: { qualifications: { id: qualificationId } }, $set: { updatedAt: new Date(), updatedBy: user.id } });
  await logChange(user, "employee.qualification.delete", "employee", `Törölve: ${item.name}`, employeeId);
  touch(employeeId);
  return { ok: true };
}

/* ---------- Kilépés és végleges törlés ---------- */

export async function recordExit(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const _id = parseId(id);
  if (!_id) return { error: "Ismeretlen munkavállaló." };
  const exitDate = day(formData, "exitDate");
  const exitReason = String(formData.get("exitReason") ?? "");
  if (!DAY.test(exitDate)) return { error: "Add meg a kilépés napját." };
  if (!isExitReason(exitReason)) return { error: "Válaszd ki a kilépés okát." };
  const result = await (await employees()).updateOne(
    { _id },
    { $set: { status: "kilepett", exitDate, exitReason, updatedAt: new Date(), updatedBy: user.id } },
  );
  if (!result.matchedCount) return { error: "A munkavállaló nem található." };
  await logChange(user, "employee.exit", "employee", `Kilépés rögzítve: ${exitDate}, ${EXIT_REASONS[exitReason]}`, id);
  touch(id);
  return { ok: true, message: "A kilépést rögzítettem." };
}

export async function deleteEmployee(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const _id = parseId(id);
  if (!_id) return { error: "Ismeretlen munkavállaló." };
  const collection = await employees();
  const doc = await collection.findOne({ _id }, { projection: { name: 1 } });
  if (!doc) return { error: "A munkavállaló nem található." };
  const typed = text(formData, "confirmName", 200);
  if (typed.toLocaleLowerCase("hu") !== doc.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("hu")) {
    return { error: "A beírt név nem egyezik. A törléshez pontosan a munkavállaló nevét írd be." };
  }
  await collection.deleteOne({ _id });
  const complete = await eraseEmployeeRecords(_id);
  await logChange(user, "employee.delete", "employee", `Munkavállaló adatai véglegesen törölve (GDPR)${complete ? ", kapcsolódó rekordokkal" : ", egyes kapcsolódó rekordok törlése sikertelen"}`, id);
  touch();
  redirect("/munkavallalok?torolve=1");
}

/* ---------- CSV-import ---------- */

export type ImportState = {
  ok?: boolean;
  error?: string;
  message?: string;
  rows?: ImportRow[];
  known?: string[];
  ignored?: string[];
  imported?: number;
};

const MAX_IMPORT_ROWS = 2000;

/** Előnézet (`mode=preview`) vagy tényleges import (`mode=import`) egy Excelből mentett CSV-ből. */
export async function importEmployees(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Válassz ki egy CSV-fájlt." };
  if (file.size > 4 * 1024 * 1024) return { error: "A fájl legfeljebb 4 MB lehet." };
  if (/\.xlsx?$/i.test(file.name)) return { error: "Ez Excel-munkafüzet. Az Excelben: Fájl → Mentés másként → „CSV (pontosvesszővel tagolt)”, majd azt töltsd fel." };

  const parsed = mapImportRows(parseCsv(decodeCsv(new Uint8Array(await file.arrayBuffer()))));
  if (parsed.error) return { error: parsed.error };
  if (parsed.rows.length === 0) return { error: "A fájlban nincs adatsor a fejléc alatt." };
  if (parsed.rows.length > MAX_IMPORT_ROWS) return { error: `Egyszerre legfeljebb ${MAX_IMPORT_ROWS} sor importálható.` };

  // Duplikátum: azonos e-mail, vagy azonos név és belépési nap – a nyilvántartásban vagy a fájl korábbi sorában.
  const existing = await (await employees()).find({}, { projection: { name: 1, email: 1, startDate: 1 } }).toArray();
  const emails = new Set(existing.map((doc) => doc.email).filter(Boolean));
  const nameKey = (name?: string, start?: string) => `${normalizeKey(name ?? "")}|${start ?? ""}`;
  const names = new Set(existing.map((doc) => nameKey(doc.name, doc.startDate)));
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  for (const row of parsed.rows) {
    const key = nameKey(row.data.name, row.data.startDate);
    if (row.data.email && emails.has(row.data.email)) row.duplicate = "Ezzel az e-mail-címmel már van munkavállaló.";
    else if (names.has(key)) row.duplicate = "Azonos nevű és belépési napú munkavállaló már szerepel.";
    else if ((row.data.email && seenEmails.has(row.data.email)) || seenNames.has(key)) row.duplicate = "A fájlban korábban már szerepel.";
    if (row.data.email) seenEmails.add(row.data.email);
    seenNames.add(key);
  }

  const importable = parsed.rows.filter((row) => row.errors.length === 0 && !row.duplicate);
  const base = { rows: parsed.rows, known: parsed.known, ignored: parsed.ignored };
  if (formData.get("mode") !== "import") return { ...base, ok: true };
  if (importable.length === 0) return { ...base, error: "Nincs importálható sor (mindegyik hibás vagy már szerepel)." };

  const now = new Date();
  const docs: EmployeeDocument[] = importable.map((row) => {
    const data = Object.fromEntries(Object.entries(row.data).filter(([, value]) => value !== undefined && value !== "")) as ImportCandidate;
    return { _id: new ObjectId(), ...data, qualifications: [], createdAt: now, updatedAt: now, createdBy: user.id, updatedBy: user.id };
  });
  await (await employees()).insertMany(docs, { ordered: false });
  const skipped = parsed.rows.length - docs.length;
  await logChange(user, "employee.import", "employee", `CSV-import: ${docs.length} munkavállaló felvéve, ${skipped} sor kihagyva`);
  touch();
  return { ok: true, imported: docs.length, message: `${docs.length} munkavállalót felvettem${skipped ? `, ${skipped} sort kihagytam` : ""}.` };
}

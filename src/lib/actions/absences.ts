"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { absences, leaveAllowances, overlappingAbsences, parseAbsenceId } from "@/lib/absences";
import { ABSENCE_TYPES, formatDays, isAbsenceType, workingDays, type AbsenceType } from "@/lib/absences-meta";
import { formatShortDate } from "@/lib/dates";
import { employeeOptions } from "@/lib/employees";
import { DAY, longText, num, optional, text, type FormState } from "@/lib/form";
import { logChange } from "@/lib/hr-log";
import { requireUser } from "@/lib/session";

export type AbsenceState = FormState & { overlap?: string[] };

const isId = (value: string) => /^[0-9a-f]{24}$/i.test(value);

type Fields = { employeeId: string; employeeName: string; type: AbsenceType; from: string; to: string; halfDay: boolean; note?: string };

async function readFields(formData: FormData): Promise<{ fields?: Fields; error?: string }> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const type = String(formData.get("type") ?? "");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "") || from;
  const halfDay = formData.get("halfDay") === "on";
  if (!isId(employeeId)) return { error: "Válaszd ki a dolgozót." };
  if (!isAbsenceType(type)) return { error: "Válaszd ki a távollét típusát." };
  if (!DAY.test(from) || !DAY.test(to)) return { error: "Add meg a távollét első és utolsó napját." };
  if (to < from) return { error: "Az utolsó nap nem lehet az első előtt." };
  if (Date.parse(to) - Date.parse(from) > 400 * 86_400_000) return { error: "Egy tétel legfeljebb kb. egy évet fedhet le; hosszabb távollétet bonts több részre." };
  if (halfDay && from !== to) return { error: "Fél nap csak egynapos távollétnél jelölhető." };
  const employee = (await employeeOptions(true)).find((option) => option.id === employeeId);
  if (!employee) return { error: "A dolgozó nem található." };
  return { fields: { employeeId, employeeName: employee.name, type, from, to, halfDay, note: optional(longText(formData, "note", 500)) } };
}

const describe = (rows: { type: AbsenceType; from: string; to: string }[]) =>
  rows.map((row) => `${ABSENCE_TYPES[row.type]}: ${formatShortDate(row.from)}${row.to !== row.from ? ` – ${formatShortDate(row.to)}` : ""}`);

/** A távollétekből számolt összes nézet frissítése. */
function touch(id?: string) {
  for (const path of ["/tavollet", "/tavollet/keret", "/kimutatasok", "/kimutatasok/riport"]) revalidatePath(path);
  for (const pattern of ["/tavollet/[id]", "/tavollet/dolgozo/[employeeId]"]) revalidatePath(pattern, "page");
  if (id) revalidatePath(`/tavollet/${id}`);
}

/** Élő figyelmeztetés az űrlapon: ugyanannak a dolgozónak átfedő távollétei. */
export async function checkAbsenceOverlap(employeeId: string, from: string, to: string, excludeId?: string): Promise<string[]> {
  await requireUser();
  if (!isId(employeeId) || !DAY.test(from) || !DAY.test(to || from)) return [];
  return describe(await overlappingAbsences(employeeId, from, to || from, excludeId));
}

async function save(formData: FormData, existingId?: ObjectId): Promise<AbsenceState> {
  const user = await requireUser();
  const { fields, error } = await readFields(formData);
  if (!fields) return { error };
  const overlap = await overlappingAbsences(fields.employeeId, fields.from, fields.to, existingId ? String(existingId) : undefined);
  if (overlap.length && formData.get("force") !== "on")
    return { error: "Erre az időszakra már van rögzített távolléte. Ha mégis rögzíteni szeretnéd, jelöld be a „Mégis rögzítem” mezőt.", overlap: describe(overlap) };
  const days = workingDays(fields.from, fields.to, fields.halfDay);
  const now = new Date();
  const collection = await absences();
  // A naplóba nem kerül a távollét típusa (pl. betegség) és a dolgozó neve.
  const summary = `Távollét, ${formatDays(days)} munkanap (${fields.from} – ${fields.to})`;
  if (existingId) {
    const { note, ...rest } = fields;
    const result = await collection.updateOne(
      { _id: existingId },
      // Az üres megjegyzés nem kerülhet a $set-be (null lenne, és ütközne az $unset-tel).
      { $set: { ...rest, ...(note !== undefined && { note }), updatedAt: now, updatedBy: user.id }, ...(note === undefined && { $unset: { note: "" } }) },
    );
    if (!result.matchedCount) return { error: "A távollét nem található." };
    await logChange(user, "absence.update", "absence", `Módosítva: ${summary}`, String(existingId));
    touch(String(existingId));
    return { ok: true, message: "Mentve." };
  }
  const _id = new ObjectId();
  const doc = { _id, ...fields, createdAt: now, updatedAt: now, createdBy: user.id, updatedBy: user.id };
  if (doc.note === undefined) delete doc.note;
  await collection.insertOne(doc);
  await logChange(user, "absence.create", "absence", summary, String(_id));
  touch();
  return { ok: true, message: `Rögzítve: ${formatDays(days)} munkanap.`, id: String(_id) };
}

export async function createAbsence(_previous: AbsenceState, formData: FormData): Promise<AbsenceState> {
  return save(formData);
}

export async function updateAbsence(_previous: AbsenceState, formData: FormData): Promise<AbsenceState> {
  const _id = parseAbsenceId(String(formData.get("id") ?? ""));
  if (!_id) {
    await requireUser();
    return { error: "Ismeretlen távollét." };
  }
  return save(formData, _id);
}

export async function deleteAbsence(id: string, back = "/tavollet"): Promise<FormState> {
  const user = await requireUser();
  const _id = parseAbsenceId(id);
  if (!_id) return { error: "Ismeretlen távollét." };
  const deleted = await (await absences()).findOneAndDelete({ _id });
  if (!deleted) return { error: "A távollét nem található." };
  await logChange(user, "absence.delete", "absence", `Távollét törölve (${deleted.from} – ${deleted.to})`, id);
  touch();
  redirect(back.startsWith("/tavollet") ? back : "/tavollet");
}

/** Éves szabadságkeret mentése (üres napszámnál a keret törlődik). */
export async function saveAllowance(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const employeeId = String(formData.get("employeeId") ?? "");
  const year = Number(formData.get("year"));
  const days = num(formData, "days");
  const carryOver = num(formData, "carryOver");
  if (!isId(employeeId)) return { error: "Ismeretlen dolgozó." };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: "Érvénytelen év." };
  if (days !== undefined && (!Number.isFinite(days) || days < 0 || days > 60)) return { error: "A keret 0 és 60 nap közötti szám lehet." };
  if (carryOver !== undefined && (!Number.isFinite(carryOver) || carryOver < 0 || carryOver > 60)) return { error: "Az áthozott napok 0 és 60 közöttiek lehetnek." };
  const collection = await leaveAllowances();
  const _id = `${employeeId}:${year}`;
  if (days === undefined) {
    await collection.deleteOne({ _id });
    await logChange(user, "leave_allowance.delete", "leave_allowance", `${year}. évi szabadságkeret törölve`, employeeId);
  } else {
    const note = optional(text(formData, "note", 200));
    await collection.updateOne(
      { _id },
      {
        $set: { employeeId, year, days, updatedAt: new Date(), updatedBy: user.id, ...(carryOver !== undefined && { carryOver }), ...(note && { note }) },
        ...((carryOver === undefined || !note) && {
          $unset: { ...(carryOver === undefined && { carryOver: "" }), ...(!note && { note: "" }) },
        }),
      },
      { upsert: true },
    );
    await logChange(user, "leave_allowance.set", "leave_allowance", `${year}. évi szabadságkeret: ${formatDays(days)} nap${carryOver ? ` + ${formatDays(carryOver)} áthozott` : ""}`, employeeId);
  }
  touch();
  return { ok: true, message: "A keret mentve." };
}

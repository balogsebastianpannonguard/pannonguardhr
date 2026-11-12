"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { employeeOptions } from "@/lib/employees";
import { DAY, longText, num, optional, text, type FormState } from "@/lib/form";
import { logChange } from "@/lib/hr-log";
import { requireUser } from "@/lib/session";
import { parseTrainingId, trainings, type TrainingDoc } from "@/lib/trainings";
import { isAttendance, isExamResult, isRepaymentStatus, isTrainingType, TRAINING_TYPES, type Participant } from "@/lib/trainings-meta";

type Fields = Pick<TrainingDoc, "name" | "type" | "startDate" | "endDate" | "trainer" | "location" | "validityMonths" | "cost" | "notes">;
const OPTIONAL_KEYS = ["endDate", "trainer", "location", "validityMonths", "cost", "notes"] as const;

function readFields(formData: FormData): { fields?: Fields; error?: string } {
  const name = text(formData, "name", 160);
  const type = String(formData.get("type") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const validityMonths = num(formData, "validityMonths");
  const cost = num(formData, "cost");
  if (name.length < 3) return { error: "Adj nevet a képzésnek (legalább 3 karakter)." };
  if (!isTrainingType(type)) return { error: "Válaszd ki a képzés típusát." };
  if (!DAY.test(startDate)) return { error: "Add meg a képzés napját." };
  if (endDate && (!DAY.test(endDate) || endDate < startDate)) return { error: "A befejezés napja nem lehet a kezdés előtt." };
  if (validityMonths !== undefined && (!Number.isInteger(validityMonths) || validityMonths < 0 || validityMonths > 240))
    return { error: "Az érvényesség 0 és 240 közötti egész hónap lehet." };
  if (cost !== undefined && (!Number.isFinite(cost) || cost < 0 || cost > 1e9)) return { error: "A költség nem értelmezhető." };
  return {
    fields: {
      name,
      type,
      startDate,
      endDate: optional(endDate !== startDate ? endDate : ""),
      trainer: optional(text(formData, "trainer", 120)),
      location: optional(text(formData, "location", 160)),
      validityMonths: validityMonths || undefined,
      cost: cost === undefined ? undefined : Math.round(cost),
      notes: optional(longText(formData, "notes", 3000)),
    },
  };
}

/** A kiválasztott résztvevők: csak létező dolgozók; a már rögzített eredmények megmaradnak. */
async function readParticipants(formData: FormData, existing: Participant[] = []) {
  const ids = [...new Set(formData.getAll("participant").map(String))].slice(0, 500);
  const options = new Map((await employeeOptions(true)).map((option) => [option.id, option]));
  const previous = new Map(existing.map((participant) => [participant.employeeId, participant]));
  return ids.flatMap((id): Participant[] => {
    const employee = options.get(id);
    if (!employee) return [];
    const kept = previous.get(id);
    return [
      kept
        ? { ...kept, name: employee.name, position: employee.position }
        : { employeeId: id, name: employee.name, position: employee.position, attendance: "", exam: "", studyContract: false },
    ];
  });
}

const clean = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;

/** A képzésekből számolt összes nézet frissítése. */
function touch(id?: string) {
  for (const path of ["/kepzesek", "/kepzesek/lejaratok", "/kepzesek/kilepok", "/kimutatasok", "/kimutatasok/riport"]) revalidatePath(path);
  for (const pattern of ["/kepzesek/[id]", "/kepzesek/[id]/jelenleti-iv", "/kepzesek/dolgozo/[employeeId]"]) revalidatePath(pattern, "page");
  if (id) revalidatePath(`/kepzesek/${id}`);
}

export async function createTraining(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { fields, error } = readFields(formData);
  if (!fields) return { error };
  const participants = await readParticipants(formData);
  const now = new Date();
  const id = new ObjectId();
  await (await trainings()).insertOne({
    _id: id,
    ...clean(fields),
    participants,
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
    updatedBy: user.id,
  });
  await logChange(user, "training.create", "training", `${TRAINING_TYPES[fields.type]}: ${fields.name} (${participants.length} résztvevő)`, String(id));
  touch();
  redirect(`/kepzesek/${id}`);
}

export async function updateTraining(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const _id = parseTrainingId(String(formData.get("id") ?? ""));
  if (!_id) return { error: "Ismeretlen képzés." };
  const { fields, error } = readFields(formData);
  if (!fields) return { error };
  const collection = await trainings();
  const current = await collection.findOne({ _id });
  if (!current) return { error: "A képzés nem található." };
  const participants = await readParticipants(formData, current.participants);
  const cleared = OPTIONAL_KEYS.filter((field) => fields[field] === undefined);
  await collection.updateOne(
    { _id },
    {
      $set: { ...clean(fields), participants, updatedAt: new Date(), updatedBy: user.id },
      ...(cleared.length && { $unset: Object.fromEntries(cleared.map((field) => [field, ""])) }),
    },
  );
  await logChange(user, "training.update", "training", `${fields.name} adatai módosítva (${participants.length} résztvevő)`, String(_id));
  touch(String(_id));
  return { ok: true, message: "Mentve." };
}

/** Résztvevőnkénti jelenlét, vizsga, tanúsítvány és tanulmányi szerződés mentése. */
export async function saveTrainingResults(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const _id = parseTrainingId(String(formData.get("id") ?? ""));
  if (!_id) return { error: "Ismeretlen képzés." };
  const collection = await trainings();
  const current = await collection.findOne({ _id });
  if (!current) return { error: "A képzés nem található." };

  const participants: Participant[] = [];
  for (const participant of current.participants) {
    const id = participant.employeeId;
    const attendance = String(formData.get(`att_${id}`) ?? "");
    const exam = String(formData.get(`exam_${id}`) ?? "");
    const score = num(formData, `score_${id}`);
    const studyContract = formData.get(`sc_${id}`) === "on";
    const studyAmount = num(formData, `scAmount_${id}`);
    if (!isAttendance(attendance) || !isExamResult(exam)) return { error: "Érvénytelen jelenlét vagy vizsgaeredmény." };
    if (score !== undefined && (!Number.isFinite(score) || score < 0 || score > 1000)) return { error: `Hibás pontszám: ${participant.name}.` };
    if (studyAmount !== undefined && (!Number.isFinite(studyAmount) || studyAmount < 0 || studyAmount > 1e9)) return { error: `Hibás összeg: ${participant.name}.` };
    participants.push(
      clean({
        employeeId: id,
        name: participant.name,
        position: participant.position,
        attendance,
        exam,
        score,
        certificateNumber: optional(text(formData, `cert_${id}`, 80)),
        studyContract,
        studyAmount: studyContract && studyAmount !== undefined ? Math.round(studyAmount) : undefined,
        repayment: studyContract ? participant.repayment : undefined,
      }),
    );
  }
  await collection.updateOne({ _id }, { $set: { participants, updatedAt: new Date(), updatedBy: user.id } });
  const passed = participants.filter((item) => item.exam === "megfelelt").length;
  await logChange(user, "training.results", "training", `${current.name}: eredmények mentve (${passed}/${participants.length} megfelelt)`, String(_id));
  touch(String(_id));
  return { ok: true, message: "Az eredmények mentve." };
}

export async function deleteTraining(id: string): Promise<FormState> {
  const user = await requireUser();
  const _id = parseTrainingId(id);
  if (!_id) return { error: "Ismeretlen képzés." };
  const collection = await trainings();
  const current = await collection.findOne({ _id }, { projection: { name: 1 } });
  if (!current) return { error: "A képzés nem található." };
  await collection.deleteOne({ _id });
  await logChange(user, "training.delete", "training", `Képzés törölve: ${current.name}`, id);
  touch();
  redirect("/kepzesek");
}

/** Kilépő dolgozó tanulmányi szerződésének visszafizetési állapota. */
export async function setRepaymentStatus(trainingId: string, employeeId: string, status: string): Promise<FormState> {
  const user = await requireUser();
  const _id = parseTrainingId(trainingId);
  if (!_id || !/^[0-9a-f]{24}$/i.test(employeeId) || !isRepaymentStatus(status)) return { error: "Érvénytelen kérés." };
  const result = await (await trainings()).updateOne(
    { _id, participants: { $elemMatch: { employeeId, studyContract: true } } },
    status ? { $set: { "participants.$.repayment": status, updatedAt: new Date(), updatedBy: user.id } } : { $unset: { "participants.$.repayment": "" }, $set: { updatedAt: new Date(), updatedBy: user.id } },
  );
  if (!result.matchedCount) return { error: "A tanulmányi szerződés nem található." };
  await logChange(user, "training.repayment", "training", `Tanulmányi szerződés visszafizetési állapota: ${status || "törölve"}`, trainingId);
  touch(trainingId);
  return { ok: true };
}

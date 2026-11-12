"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addDays, dayKey } from "@/lib/dates";
import { EXIT_REASONS, employees, getEmployee, parseId, type ExitReason } from "@/lib/employees";
import { DAY, longText, optional, text, type FormState } from "@/lib/form";
import { logChange } from "@/lib/hr-log";
import {
  DEFAULT_STEPS,
  PROCESS_KINDS,
  PROCESS_STATUS,
  checklistId,
  checklists,
  getChecklist,
  isProcessKind,
  isProcessStatus,
  processes,
  stepsFromTemplate,
  type ProcessStep,
} from "@/lib/processes";
import { requireUser } from "@/lib/session";

const LIST = "/be-kilepes";

function refreshPaths(processId?: string, employeeId?: string) {
  revalidatePath(LIST);
  if (processId) revalidatePath(`${LIST}/${processId}`);
  if (employeeId) revalidatePath(`/munkavallalok/${employeeId}`);
  revalidatePath("/");
}

/* ---------- Folyamat indítása ---------- */

export async function createProcess(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "");
  const employeeId = parseId(String(formData.get("employeeId") ?? ""));
  const referenceDate = String(formData.get("referenceDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const responsible = text(formData, "responsible", 80);
  const note = longText(formData, "note", 2000);
  if (!isProcessKind(kind)) return { error: "Válaszd ki, hogy belépés vagy kilépés." };
  if (!employeeId) return { error: "Válassz munkavállalót." };
  if (!DAY.test(referenceDate)) return { error: kind === "belepes" ? "Add meg a munkába lépés napját." : "Add meg a munkaviszony megszűnésének napját." };
  if (dueDate && !DAY.test(dueDate)) return { error: "A határidő formátuma hibás." };

  const employee = await getEmployee(String(employeeId));
  if (!employee) return { error: "A munkavállaló nem található." };

  const recordExit = kind === "kilepes" && formData.get("recordExit") === "on";
  const exitReason = String(formData.get("exitReason") ?? "");
  if (recordExit && !(exitReason in EXIT_REASONS)) return { error: "Válaszd ki a kilépés okát." };

  const { steps: template } = await getChecklist(kind);
  const steps = stepsFromTemplate(template, referenceDate);
  const lastStep = steps.map((step) => step.dueDate ?? referenceDate).sort().at(-1) ?? referenceDate;
  const now = new Date();
  const id = new ObjectId();
  await (await processes()).insertOne({
    _id: id,
    kind,
    employeeId,
    employeeName: employee.name,
    position: employee.position,
    referenceDate,
    startDate: dayKey(now),
    dueDate: dueDate || (lastStep < referenceDate ? referenceDate : lastStep),
    responsible: optional(responsible) ?? user.name,
    status: "nyitott",
    note: optional(note),
    steps,
    createdAt: now,
    createdBy: user.name,
    updatedAt: now,
    updatedBy: user.name,
  });
  await logChange(user, "process.create", "process", `${PROCESS_KINDS[kind]} folyamat indítva (${steps.length} lépés)`, String(id));

  if (recordExit) {
    await (await employees()).updateOne(
      { _id: employeeId },
      { $set: { status: "kilepett", exitDate: referenceDate, exitReason: exitReason as ExitReason, updatedAt: now, updatedBy: user.id } },
    );
    await logChange(user, "employee.exit", "employee", `Kilépés rögzítve: ${EXIT_REASONS[exitReason as ExitReason]}`, String(employeeId));
    revalidatePath("/munkavallalok");
  }

  refreshPaths(String(id), String(employeeId));
  redirect(`${LIST}/${id}`);
}

/* ---------- Lépések ---------- */

async function loadOpen(processId: string) {
  const _id = parseId(processId);
  if (!_id) return null;
  return (await processes()).findOne({ _id });
}

export async function toggleStep(processId: string, stepId: string, done: boolean): Promise<FormState> {
  const user = await requireUser();
  const current = await loadOpen(processId);
  if (!current) return { error: "A folyamat nem található." };
  const step = current.steps.find((item) => item.id === stepId);
  if (!step) return { error: "A lépés nem található." };
  const now = new Date();
  await (await processes()).updateOne(
    { _id: current._id, "steps.id": stepId },
    done
      ? { $set: { "steps.$.done": true, "steps.$.doneAt": now, "steps.$.doneBy": user.name, updatedAt: now, updatedBy: user.name } }
      : { $set: { "steps.$.done": false, updatedAt: now, updatedBy: user.name }, $unset: { "steps.$.doneAt": "", "steps.$.doneBy": "" } },
  );
  await logChange(user, done ? "process.step_done" : "process.step_undone", "process", `Lépés ${done ? "kész" : "visszanyitva"}: ${step.title}`, processId);
  refreshPaths(processId, String(current.employeeId));
  return { ok: true };
}

export async function updateStep(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const processId = String(formData.get("processId") ?? "");
  const stepId = String(formData.get("stepId") ?? "");
  const title = text(formData, "title", 160);
  const dueDate = String(formData.get("dueDate") ?? "");
  const comment = longText(formData, "comment", 2000);
  if (title.length < 2) return { error: "Adj nevet a lépésnek." };
  if (dueDate && !DAY.test(dueDate)) return { error: "A határidő formátuma hibás." };
  const current = await loadOpen(processId);
  const step = current?.steps.find((item) => item.id === stepId);
  if (!current || !step) return { error: "A lépés nem található." };

  const now = new Date();
  const set: Record<string, unknown> = { "steps.$.title": title, updatedAt: now, updatedBy: user.name };
  const unset: Record<string, ""> = {};
  if (dueDate) set["steps.$.dueDate"] = dueDate;
  else unset["steps.$.dueDate"] = "";
  if (comment) {
    set["steps.$.comment"] = comment;
    if (comment !== step.comment) {
      set["steps.$.commentAt"] = now;
      set["steps.$.commentBy"] = user.name;
    }
  } else Object.assign(unset, { "steps.$.comment": "", "steps.$.commentAt": "", "steps.$.commentBy": "" });

  await (await processes()).updateOne({ _id: current._id, "steps.id": stepId }, { $set: set, ...(Object.keys(unset).length && { $unset: unset }) });
  await logChange(user, "process.step_update", "process", `Lépés módosítva: ${title}`, processId);
  refreshPaths(processId);
  return { ok: true, message: "Mentve." };
}

export async function addStep(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const processId = String(formData.get("processId") ?? "");
  const title = text(formData, "title", 160);
  const dueDate = String(formData.get("dueDate") ?? "");
  if (title.length < 2) return { error: "Adj nevet a lépésnek." };
  if (dueDate && !DAY.test(dueDate)) return { error: "A határidő formátuma hibás." };
  const current = await loadOpen(processId);
  if (!current) return { error: "A folyamat nem található." };
  if (current.steps.length >= 60) return { error: "Egy folyamatban legfeljebb 60 lépés lehet." };
  const now = new Date();
  const step: ProcessStep = { id: new ObjectId().toHexString(), title, dueDate: optional(dueDate), done: false };
  await (await processes()).updateOne({ _id: current._id }, { $push: { steps: step }, $set: { updatedAt: now, updatedBy: user.name } });
  await logChange(user, "process.step_add", "process", `Új lépés: ${title}`, processId);
  refreshPaths(processId);
  return { ok: true, message: "Hozzáadva." };
}

export async function removeStep(processId: string, stepId: string): Promise<FormState> {
  const user = await requireUser();
  const current = await loadOpen(processId);
  const step = current?.steps.find((item) => item.id === stepId);
  if (!current || !step) return { error: "A lépés nem található." };
  const now = new Date();
  await (await processes()).updateOne({ _id: current._id }, { $pull: { steps: { id: stepId } }, $set: { updatedAt: now, updatedBy: user.name } });
  await logChange(user, "process.step_remove", "process", `Lépés törölve: ${step.title}`, processId);
  refreshPaths(processId);
  return { ok: true };
}

/* ---------- Folyamat adatai, lezárás, törlés ---------- */

export async function updateProcess(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const processId = String(formData.get("processId") ?? "");
  const status = String(formData.get("status") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const responsible = text(formData, "responsible", 80);
  const note = longText(formData, "note", 2000);
  if (!isProcessStatus(status)) return { error: "Válassz állapotot." };
  if (dueDate && !DAY.test(dueDate)) return { error: "A határidő formátuma hibás." };
  const current = await loadOpen(processId);
  if (!current) return { error: "A folyamat nem található." };

  const now = new Date();
  const set: Record<string, unknown> = { status, updatedAt: now, updatedBy: user.name };
  const unset: Record<string, ""> = {};
  for (const [key, value] of [["dueDate", dueDate], ["responsible", responsible], ["note", note]] as const) {
    if (value) set[key] = value;
    else unset[key] = "";
  }
  if (status !== "nyitott" && current.status === "nyitott") set.closedAt = now;
  if (status === "nyitott") unset.closedAt = "";
  await (await processes()).updateOne({ _id: current._id }, { $set: set, ...(Object.keys(unset).length && { $unset: unset }) });
  await logChange(
    user,
    "process.update",
    "process",
    current.status === status ? "Folyamat adatai módosítva" : `Állapot: ${PROCESS_STATUS[current.status]} → ${PROCESS_STATUS[status]}`,
    processId,
  );
  refreshPaths(processId, String(current.employeeId));
  return { ok: true, message: "Mentve." };
}

export async function closeProcess(processId: string): Promise<FormState> {
  const user = await requireUser();
  const current = await loadOpen(processId);
  if (!current) return { error: "A folyamat nem található." };
  const now = new Date();
  await (await processes()).updateOne({ _id: current._id }, { $set: { status: "lezart", closedAt: now, updatedAt: now, updatedBy: user.name } });
  await logChange(user, "process.close", "process", `${PROCESS_KINDS[current.kind]} folyamat lezárva`, processId);
  refreshPaths(processId, String(current.employeeId));
  return { ok: true };
}

export async function deleteProcess(processId: string): Promise<FormState> {
  const user = await requireUser();
  const current = await loadOpen(processId);
  if (!current) return { error: "A folyamat nem található." };
  await (await processes()).deleteOne({ _id: current._id });
  await logChange(user, "process.delete", "process", `${PROCESS_KINDS[current.kind]} folyamat törölve`, processId);
  refreshPaths(undefined, String(current.employeeId));
  redirect(LIST);
}

/* ---------- Ellenőrzőlista-sablonok szerkesztése ---------- */

const StepsSchema = z
  .array(
    z.object({
      title: z.string().trim().min(2, "Minden lépésnek adj nevet.").max(160),
      hint: z.string().trim().max(600).optional(),
      offsetDays: z.number().int().min(-365).max(365),
      optional: z.boolean().optional(),
    }),
  )
  .min(1, "Legalább egy lépés kell.")
  .max(40, "Legfeljebb 40 lépés lehet.");

export async function saveChecklist(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "");
  if (!isProcessKind(kind)) return { error: "Ismeretlen folyamattípus." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("steps") ?? "[]"));
  } catch {
    return { error: "A lista nem értelmezhető." };
  }
  const parsed = StepsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Hibás lista." };
  const steps = parsed.data.map((step) => ({ title: step.title, offsetDays: step.offsetDays, ...(step.hint && { hint: step.hint }), ...(step.optional && { optional: true }) }));
  await (await checklists()).updateOne(
    { _id: checklistId(kind) },
    { $set: { kind: "checklist", steps, updatedAt: new Date(), updatedBy: user.name } },
    { upsert: true },
  );
  await logChange(user, "checklist.update", "checklist", `${PROCESS_KINDS[kind]} ellenőrzőlista mentve (${steps.length} lépés)`, kind);
  revalidatePath(`${LIST}/sablonok`);
  return { ok: true, message: "Mentve. Az új folyamatok már ezzel a listával indulnak." };
}

export async function resetChecklist(kind: string): Promise<FormState> {
  const user = await requireUser();
  if (!isProcessKind(kind)) return { error: "Ismeretlen folyamattípus." };
  await (await checklists()).deleteOne({ _id: checklistId(kind) });
  await logChange(user, "checklist.reset", "checklist", `${PROCESS_KINDS[kind]} ellenőrzőlista visszaállítva (${DEFAULT_STEPS[kind].length} lépés)`, kind);
  revalidatePath(`${LIST}/sablonok`);
  return { ok: true, message: "Visszaállítva az alapértelmezett listára." };
}

/** A határidők eltolása, ha a viszonyítási nap változik (pl. később lép be). */
export async function shiftReferenceDate(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const processId = String(formData.get("processId") ?? "");
  const referenceDate = String(formData.get("referenceDate") ?? "");
  if (!DAY.test(referenceDate)) return { error: "Adj meg érvényes dátumot." };
  const current = await loadOpen(processId);
  if (!current) return { error: "A folyamat nem található." };
  const diff = Math.round((Date.parse(`${referenceDate}T12:00:00Z`) - Date.parse(`${current.referenceDate}T12:00:00Z`)) / 86_400_000);
  if (diff === 0) return { ok: true, message: "Nincs változás." };
  const now = new Date();
  const steps = current.steps.map((step) => (step.dueDate && !step.done ? { ...step, dueDate: addDays(step.dueDate, diff) } : step));
  await (await processes()).updateOne(
    { _id: current._id },
    { $set: { referenceDate, steps, ...(current.dueDate && { dueDate: addDays(current.dueDate, diff) }), updatedAt: now, updatedBy: user.name } },
  );
  await logChange(user, "process.shift", "process", `Viszonyítási nap eltolva (${diff > 0 ? "+" : ""}${diff} nap)`, processId);
  refreshPaths(processId);
  return { ok: true, message: `A nyitott lépések határideje ${Math.abs(diff)} nappal ${diff > 0 ? "később" : "korábban"} lett.` };
}

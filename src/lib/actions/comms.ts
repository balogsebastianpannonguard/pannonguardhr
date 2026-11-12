"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { AiError, aiAvailable, aiText } from "@/lib/ai";
import { takeQuota } from "@/lib/assistant";
import {
  AUDIENCES,
  DOC_TYPES,
  REFINES,
  draftSystem,
  draftTitle,
  drafts,
  getDraft,
  isDocType,
  isLength,
  isRefine,
  isTone,
  plainDraft,
  refineSystem,
  type DraftBox,
} from "@/lib/comms";
import { sealData } from "@/lib/data-box";
import { longText, text, type FormState } from "@/lib/form";
import { logChange } from "@/lib/hr-log";
import { requireUser } from "@/lib/session";

const NO_AI = "A szövegíráshoz GEMINI_API_KEY szükséges a szerveren.";
const MAX_BODY = 20_000;
const QUOTA = 60;

const failure = (error: unknown) => ({ error: error instanceof AiError ? error.message : "Az AI most nem érhető el. Próbáld újra kicsit később." });

function paths(id?: string) {
  revalidatePath("/kommunikacio");
  if (id) revalidatePath(`/kommunikacio/${id}`);
}

/** Új vázlat a megadott szempontok alapján, mentéssel. */
export async function generateDraft(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!aiAvailable()) return { error: NO_AI };

  const type = String(formData.get("type") ?? "");
  const tone = String(formData.get("tone") ?? "");
  const length = String(formData.get("length") ?? "");
  if (!isDocType(type)) return { error: "Válaszd ki a dokumentum típusát." };
  if (!isTone(tone)) return { error: "Válassz hangnemet." };
  if (!isLength(length)) return { error: "Válassz terjedelmet." };
  const audience = text(formData, "audience", 120) || AUDIENCES[0];
  const subject = text(formData, "subject", 160);
  const points = longText(formData, "points", 6000);
  const signature = formData.get("withSignature") ? longText(formData, "signature", 400) : "";
  if (points.length < 10 && subject.length < 5) return { error: "Írd le röviden, miről szóljon (tárgy vagy legalább egy kulcspont)." };
  if (!(await takeQuota(user.id, "hr-comms", QUOTA))) return { error: `Elérted az óránkénti keretet (${QUOTA} szövegírás). Próbáld újra később.` };

  try {
    const raw = await aiText({
      system: draftSystem({ type, tone, audience, length, signature }),
      content: [`Tárgy / téma: ${subject || "(nincs megadva)"}`, "Kulcspontok:", "<pontok>", points || "(nincs megadva)", "</pontok>"].join("\n"),
      tier: "smart",
      maxTokens: 4000,
    });
    const body = plainDraft(raw).slice(0, MAX_BODY);
    if (!body) return { error: "Az AI üres választ adott. Adj meg több részletet." };
    const now = new Date();
    const id = new ObjectId();
    const box: DraftBox = { title: draftTitle(body, subject, type), body, brief: { audience, length, subject, points, signature } };
    await (await drafts()).insertOne({ _id: id, ownerId: user.id, type, tone, createdAt: now, updatedAt: now, box: sealData(box) });
    await logChange(user, "draft.create", "hr_drafts", `Vázlat készült: ${DOC_TYPES[type]}`, String(id));
    paths();
    return { ok: true, id: String(id) };
  } catch (error) {
    return failure(error);
  }
}

/** A szerkesztett cím és szöveg mentése. */
export async function saveDraft(id: string, input: { title: string; body: string }): Promise<FormState> {
  const user = await requireUser();
  const draft = await getDraft(user.id, id);
  if (!draft) return { error: "A vázlat nem található." };
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const body = String(input.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_BODY);
  if (!body) return { error: "A szöveg nem lehet üres." };
  const box: DraftBox = { title: title || draft.title, body, previous: draft.previous, brief: draft.brief };
  await (await drafts()).updateOne({ _id: new ObjectId(id), ownerId: user.id }, { $set: { box: sealData(box), updatedAt: new Date() } });
  await logChange(user, "draft.update", "hr_drafts", "Vázlat szerkesztve", id);
  paths(id);
  return { ok: true, message: "Mentve." };
}

/** Gyors átírás (rövidebb / hivatalosabb / barátságosabb); az előző változat visszaállítható. */
export async function refineDraft(id: string, mode: string, input: { title: string; body: string }): Promise<FormState & { body?: string }> {
  const user = await requireUser();
  if (!aiAvailable()) return { error: NO_AI };
  if (!isRefine(mode)) return { error: "Ismeretlen átírási mód." };
  const draft = await getDraft(user.id, id);
  if (!draft) return { error: "A vázlat nem található." };
  const current = String(input.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_BODY);
  if (current.length < 10) return { error: "Előbb legyen szöveg, amit átírhatok." };
  if (!(await takeQuota(user.id, "hr-comms", QUOTA))) return { error: `Elérted az óránkénti keretet (${QUOTA} szövegírás). Próbáld újra később.` };

  try {
    const body = plainDraft(await aiText({ system: refineSystem(mode), content: `<szoveg>\n${current}\n</szoveg>`, tier: "smart", maxTokens: 4000 })).slice(0, MAX_BODY);
    if (!body) return { error: "Az AI üres választ adott." };
    const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || draft.title;
    const box: DraftBox = { title, body, previous: current, brief: draft.brief };
    await (await drafts()).updateOne({ _id: new ObjectId(id), ownerId: user.id }, { $set: { box: sealData(box), updatedAt: new Date() } });
    await logChange(user, "draft.refine", "hr_drafts", `Vázlat átírva: ${REFINES[mode].toLowerCase()}`, id);
    paths(id);
    return { ok: true, body, message: `Átírva: ${REFINES[mode].toLowerCase()}.` };
  } catch (error) {
    return failure(error);
  }
}

/** Az utolsó átírás visszavonása (az előző szöveg visszaállítása). */
export async function undoRefine(id: string): Promise<FormState & { body?: string }> {
  const user = await requireUser();
  const draft = await getDraft(user.id, id);
  if (!draft) return { error: "A vázlat nem található." };
  if (!draft.previous) return { error: "Nincs visszaállítható előző változat." };
  const box: DraftBox = { title: draft.title, body: draft.previous, previous: draft.body, brief: draft.brief };
  await (await drafts()).updateOne({ _id: new ObjectId(id), ownerId: user.id }, { $set: { box: sealData(box), updatedAt: new Date() } });
  await logChange(user, "draft.update", "hr_drafts", "Vázlat: előző változat visszaállítva", id);
  paths(id);
  return { ok: true, body: draft.previous, message: "Visszaállítva az előző változat." };
}

export async function duplicateDraft(id: string): Promise<FormState> {
  const user = await requireUser();
  const draft = await getDraft(user.id, id);
  if (!draft) return { error: "A vázlat nem található." };
  const now = new Date();
  const copy = new ObjectId();
  const box: DraftBox = { title: `${draft.title} (másolat)`.slice(0, 120), body: draft.body, brief: draft.brief };
  await (await drafts()).insertOne({ _id: copy, ownerId: user.id, type: draft.type, tone: draft.tone, createdAt: now, updatedAt: now, box: sealData(box) });
  await logChange(user, "draft.duplicate", "hr_drafts", `Vázlat másolva: ${DOC_TYPES[draft.type]}`, String(copy));
  paths();
  return { ok: true, id: String(copy) };
}

export async function deleteDraft(id: string): Promise<FormState> {
  const user = await requireUser();
  if (!ObjectId.isValid(id)) return { error: "Ismeretlen vázlat." };
  const result = await (await drafts()).deleteOne({ _id: new ObjectId(id), ownerId: user.id });
  if (!result.deletedCount) return { error: "A vázlat már nem létezik." };
  await logChange(user, "draft.delete", "hr_drafts", "Vázlat törölve", id);
  paths(id);
  return { ok: true };
}

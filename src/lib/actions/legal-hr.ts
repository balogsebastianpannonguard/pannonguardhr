"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { AiError, aiAvailable, aiJson, aiText, aiTranscribe } from "@/lib/ai";
import { takeQuota } from "@/lib/assistant";
import { sealData } from "@/lib/data-box";
import { dayKey } from "@/lib/dates";
import { longText, text, type FormState } from "@/lib/form";
import { logChange } from "@/lib/hr-log";
import {
  CompareSchema,
  ReviewSchema,
  compareSystem,
  legalItems,
  questionSystem,
  reviewSystem,
  type CompareBox,
  type LegalKind,
  type QuestionBox,
  type ReviewBox,
} from "@/lib/legal-hr";
import { requireUser } from "@/lib/session";

const NO_AI = "Az AI-funkciókhoz GEMINI_API_KEY szükséges a szerveren.";
const MAX_DOC_CHARS = 60_000;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

const failure = (error: unknown) => ({ error: error instanceof AiError ? error.message : "Az AI most nem érhető el. Próbáld újra kicsit később." });
const today = () => dayKey(new Date());

/** A markdown-címsorokat félkövér sorrá alakítja (a RichText csak a **félkövért** és a felsorolást ismeri). */
function tidy(answer: string) {
  return answer
    .replace(/^```[a-z]*\n?|\n?```$/g, "")
    .replace(/^#{1,6}\s*(.+?)\s*#*$/gm, "**$1**")
    .replace(/^\s*\*\s+/gm, "- ")
    .trim();
}

async function save(ownerId: string, kind: LegalKind, box: QuestionBox | ReviewBox | CompareBox, meta?: { high?: number; total?: number }) {
  const id = new ObjectId();
  await (await legalItems()).insertOne({ _id: id, ownerId, kind, createdAt: new Date(), box: sealData(box), ...(meta && { meta }) });
  return String(id);
}

/** Munkajogi kérdés megválaszolása és mentése az előzmények közé. */
export async function askLegalQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!aiAvailable()) return { error: NO_AI };
  const question = longText(formData, "question", 4000);
  if (question.length < 10) return { error: "Írd le a kérdést legalább egy mondatban (10 karakter)." };
  if (!(await takeQuota(user.id, "hr-legal", 40))) return { error: "Elérted az óránkénti keretet (40 jogi AI-kérés). Próbáld újra később." };

  try {
    const answer = tidy(await aiText({ system: questionSystem(today()), content: `<kerdes>\n${question}\n</kerdes>`, tier: "smart", maxTokens: 6000 }));
    if (!answer) return { error: "Az AI üres választ adott. Fogalmazd meg másképp a kérdést." };
    const id = await save(user.id, "kerdes", { question, answer });
    await logChange(user, "legal.ask", "hr_legal", "Munkajogi kérdés megválaszolva", id);
    revalidatePath("/jog");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

/** Szabályzat vagy egyéb HR-irat ellenőrzése. */
export async function reviewLegalDocument(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!aiAvailable()) return { error: NO_AI };
  const source = longText(formData, "source", MAX_DOC_CHARS + 1);
  const title = text(formData, "title", 120) || source.split("\n", 1)[0].slice(0, 80) || "Névtelen irat";
  const focus = longText(formData, "focus", 800);
  if (source.length < 40) return { error: "Illeszd be az ellenőrizendő szöveget (legalább 40 karakter), vagy tölts fel fájlt." };
  if (source.length > MAX_DOC_CHARS) return { error: `A szöveg túl hosszú; egyszerre legfeljebb ${MAX_DOC_CHARS.toLocaleString("hu-HU")} karakter ellenőrizhető.` };
  if (!(await takeQuota(user.id, "hr-legal", 40))) return { error: "Elérted az óránkénti keretet (40 jogi AI-kérés). Próbáld újra később." };

  try {
    const result = await aiJson({
      system: reviewSystem(today()),
      content: [`Az irat megnevezése: ${title}`, focus && `Külön figyelj erre: ${focus}`, `<irat>\n${source}\n</irat>`].filter(Boolean).join("\n\n"),
      schema: ReviewSchema,
      tier: "smart",
    });
    const high = result.risks.filter((risk) => risk.severity === "magas").length;
    const id = await save(user.id, "ellenorzes", { title, source, result }, { high, total: result.risks.length + result.missing.length });
    await logChange(user, "legal.review", "hr_legal", `Irat-ellenőrzés: ${result.risks.length} kockázat, ${high} magas`, id);
    revalidatePath("/jog");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

/** Két változat összevetése: a különbségnézet determinisztikus, az összefoglalót az AI írja. */
export async function compareLegalDocuments(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!aiAvailable()) return { error: NO_AI };
  const before = longText(formData, "before", MAX_DOC_CHARS + 1);
  const after = longText(formData, "after", MAX_DOC_CHARS + 1);
  const titleA = text(formData, "titleA", 80) || "Régi változat";
  const titleB = text(formData, "titleB", 80) || "Új változat";
  if (before.length < 20 || after.length < 20) return { error: "Mindkét változat szövegét add meg (legalább 20-20 karakter)." };
  if (before.length > MAX_DOC_CHARS || after.length > MAX_DOC_CHARS) {
    return { error: `Egy változat legfeljebb ${MAX_DOC_CHARS.toLocaleString("hu-HU")} karakter lehet.` };
  }
  if (before === after) return { error: "A két szöveg teljesen azonos, nincs mit összevetni." };
  if (!(await takeQuota(user.id, "hr-legal", 40))) return { error: "Elérted az óránkénti keretet (40 jogi AI-kérés). Próbáld újra később." };

  try {
    const result = await aiJson({
      system: compareSystem(today()),
      content: `<regi cim="${titleA.replace(/"/g, "'")}">\n${before}\n</regi>\n\n<uj cim="${titleB.replace(/"/g, "'")}">\n${after}\n</uj>`,
      schema: CompareSchema,
      tier: "smart",
    });
    const high = result.changes.filter((change) => change.severity === "magas").length;
    const id = await save(user.id, "osszehasonlitas", { titleA, titleB, before, after, result }, { high, total: result.changes.length });
    await logChange(user, "legal.compare", "hr_legal", `Összehasonlítás: ${result.changes.length} érdemi változás`, id);
    revalidatePath("/jog");
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

/** Feltöltött PDF / JPG / PNG szövegének kinyerése (OCR), hogy a felhasználó a beküldés előtt átnézhesse. */
export async function extractLegalText(formData: FormData): Promise<{ text?: string; error?: string }> {
  const user = await requireUser();
  if (!aiAvailable()) return { error: NO_AI };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Válassz fájlt." };
  if (file.size > MAX_FILE_BYTES) return { error: "A fájl legfeljebb 4 MB lehet." };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = FILE_TYPES[extension];
  if (!mimeType) return { error: "Csak PDF, JPG vagy PNG fájl tölthető fel (a Word-fájlt mentsd PDF-be, vagy másold be a szövegét)." };
  if (!(await takeQuota(user.id, "hr-ocr", 30))) return { error: "Elérted az óránkénti keretet (30 szövegfelismerés). Próbáld újra később." };

  try {
    const extracted = await aiTranscribe({ data: Buffer.from(await file.arrayBuffer()), mimeType, fileName: file.name.slice(0, 120) });
    if (!extracted.trim()) return { error: "A fájlban nem találtam olvasható szöveget." };
    return { text: extracted.slice(0, MAX_DOC_CHARS) };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteLegalItem(id: string): Promise<FormState> {
  const user = await requireUser();
  if (!ObjectId.isValid(id)) return { error: "Ismeretlen tétel." };
  const result = await (await legalItems()).deleteOne({ _id: new ObjectId(id), ownerId: user.id });
  if (!result.deletedCount) return { error: "A tétel már nem létezik." };
  await logChange(user, "legal.delete", "hr_legal", "Jogi előzmény törölve", id);
  revalidatePath("/jog");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { commitAppsheet, openAppsheetSecret, previewAppsheet, readAppsheetFile, type AppsheetSummary } from "@/lib/appsheet";
import { employees, parseId } from "@/lib/employees";
import { logChange } from "@/lib/hr-log";
import { requireUser } from "@/lib/session";

export type AppsheetState = { ok?: boolean; error?: string; summary?: AppsheetSummary; committed?: boolean };

const MAX_BYTES = 4 * 1024 * 1024;

/** Az AppSheet-export előnézete (`mode=preview`) vagy betöltése (`mode=import`). */
export async function importAppsheet(_previous: AppsheetState, formData: FormData): Promise<AppsheetState> {
  const user = await requireUser();
  const upload = formData.get("file");
  if (!(upload instanceof File) || upload.size === 0) return { error: "Válaszd ki az AppSheet-ből exportált CSV-fájlt." };
  if (upload.size > MAX_BYTES) return { error: "A fájl legfeljebb 4 MB lehet." };
  if (/\.xlsx?$/i.test(upload.name)) return { error: "Ez Excel-munkafüzet. Az AppSheet-ből CSV-ként exportált fájlt töltsd fel." };
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const { file, error } = readAppsheetFile(bytes);
  if (!file) return { error };
  if (file.rows.length > 5000) return { error: "Egyszerre legfeljebb 5000 sor tölthető be." };
  const name = upload.name.slice(0, 160);

  if (formData.get("mode") !== "import") return { ok: true, summary: await previewAppsheet(name, file) };

  const summary = await commitAppsheet(name, file, bytes, user);
  revalidatePath("/munkavallalok", "layout");
  revalidatePath("/lejaratok");
  revalidatePath("/");
  return { ok: true, summary, committed: true };
}

/** Az AppSheet-adatlap bizalmas celláinak megjelenítése: kifejezett kérésre, naplózva. */
export async function revealAppsheetSecret(id: string): Promise<{ values?: Record<string, string>; error?: string }> {
  const user = await requireUser();
  const _id = parseId(id);
  if (!_id) return { error: "Ismeretlen munkatárs." };
  const doc = await (await employees()).findOne({ _id }, { projection: { "appsheet.key": 1, "appsheet.secret": 1 } });
  if (!doc?.appsheet) return { error: "Ehhez a munkatárshoz nincs AppSheet-adatlap." };
  try {
    const values = openAppsheetSecret(doc.appsheet);
    await logChange(user, "employee.appsheet.view", "employee", "AppSheet-adatlap bizalmas adatai megtekintve", id);
    return { values };
  } catch {
    return { error: "A bizalmas adatok nem fejthetők vissza (titkosítási kulcs hiba). Szólj a rendszergazdának." };
  }
}

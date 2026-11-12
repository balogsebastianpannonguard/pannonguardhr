"use server";

import { AiError, aiAvailable, aiText } from "@/lib/ai";
import { takeQuota } from "@/lib/assistant";
import { logChange } from "@/lib/hr-log";
import { buildReport, reportFacts, resolvePeriod } from "@/lib/reports";
import { requireUser } from "@/lib/session";

export type NarrativeState = { ok?: boolean; text?: string; error?: string };

const SYSTEM = [
  "HR-elemző vagy a PannonGuard Biztonsági Szolgáltató Zrt.-nél (őrzés-védelem). A HR-vezető számára vezetői riporthoz írsz szöveges értékelést.",
  "Kizárólag a megadott összesített számokra támaszkodj; ne találj ki számot, okot, nevet vagy összehasonlítást, amely nincs az adatokban.",
  "Ha egy adat hiányzik vagy kevés (pl. kis létszám, nincs vizsga), mondd ki óvatosan, és ne vonj le belőle messzemenő következtetést.",
  "Szerkezet, egyszerű szövegként (Markdown-jelölés, csillag és kettőskereszt nélkül), magyarul, tárgyszerű, de közérthető vezetői hangon:",
  "1) Összegzés (2–3 mondat). 2) Létszám és fluktuáció. 3) Távollétek. 4) Képzések és tanúsítványok. 5) Javasolt teendők (3–5 rövid, gondolatjellel kezdődő pont).",
  "A szakaszcímeket külön sorba írd, kettősponttal a végén. Legfeljebb kb. 350 szó.",
].join(" ");

/** AI-vázlat a vezetői riport szöveges értékeléséhez – csak összesített számokat kap, személyes adatot nem. */
export async function draftReportNarrative(params: { idoszak?: string; tol?: string; ig?: string }): Promise<NarrativeState> {
  const user = await requireUser();
  if (!aiAvailable()) return { error: "Az AI-vázlathoz GEMINI_API_KEY szükséges a szerveren. A szöveget kézzel is megírhatod." };
  if (!(await takeQuota(user.id, "hr-report", 10))) return { error: "Ebben az órában már sok vázlat készült. Próbáld újra egy kicsit később." };
  const period = resolvePeriod({ idoszak: String(params.idoszak ?? ""), tol: String(params.tol ?? ""), ig: String(params.ig ?? "") });
  try {
    const data = await buildReport(period);
    const text = await aiText({ system: SYSTEM, content: `Összesített HR-adatok:\n${reportFacts(data)}`, tier: "smart", maxTokens: 3000 });
    const clean = text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim();
    if (!clean) return { error: "Az AI üres választ adott. Próbáld újra." };
    await logChange(user, "report.narrative", "report", `AI-vázlat a vezetői riporthoz (${period.fromMonth} – ${period.toMonth})`);
    return { ok: true, text: clean };
  } catch (error) {
    return { error: error instanceof AiError ? error.message : "A vázlat most nem készült el. Próbáld újra." };
  }
}

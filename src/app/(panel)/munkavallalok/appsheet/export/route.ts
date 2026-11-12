import { appsheetCsv } from "@/lib/appsheet";
import { logChange } from "@/lib/hr-log";
import { requireUser } from "@/lib/session";

/**
 * A legutóbb betöltött AppSheet-export visszaállítása a rendszerben tárolt (titkosított) adatokból – ugyanabban
 * a formában, mint az eredeti fájl. Bizalmas adatot tartalmaz, ezért a letöltés a változásnaplóba kerül.
 */
export async function GET() {
  const user = await requireUser();
  const csv = await appsheetCsv();
  if (!csv) return new Response("Még nem volt AppSheet-betöltés.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  await logChange(user, "appsheet.export", "appsheet", `AppSheet-formátumú export: ${csv.rows} munkatárs`);
  const ascii = csv.name.replace(/[^\w.() -]/g, "_");
  return new Response(csv.text, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(csv.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

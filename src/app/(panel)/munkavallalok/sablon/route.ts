import { templateCsv } from "@/lib/employees-csv";
import { requireUser } from "@/lib/session";

/** Üres importsablon a magyar Excelhez (UTF-8 BOM, pontosvessző), egy példasorral. */
export async function GET() {
  await requireUser();
  return new Response(templateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="munkavallalok-import-sablon.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
